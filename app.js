const express = require("express");
const app = express();
app.use(express.json());

const path = require("path");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const dbPath = path.join(__dirname, "twitterClone.db");

let db;
const initializeDbAndServer = async () => {
  try {
    db = await open({ filename: dbPath, driver: sqlite3.Database });
    app.listen(3000, () => {
      console.log("server running");
    });
  } catch (e) {
    console.log(`DB Error : ${e.message}`);
  }
};
initializeDbAndServer();

module.exports = app;

const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "asdfghjkl", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        request.username = payload;
        const dbUser = `SELECT * FROM user WHERE username = '${payload}'`;
        const dbUserResponse = await db.get(dbUser);
        request.user_id = dbUserResponse.user_id;
        next();
      }
    });
  }
};

//POST                          API - 1

app.post("/register/", async (request, response) => {
  const { username, password, name, gender } = request.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  const getUserQuery = `SELECT * FROM user WHERE username = '${username}'`;
  const existUser = await db.get(getUserQuery);
  console.log(existUser, hashedPassword);

  if (existUser !== undefined) {
    response.status(400);
    response.send("User already exists");
  } else {
    if (password.length < 6) {
      response.status(400);
      response.send("Password is too short");
    } else {
      const createUser = `
        INSERT INTO 
          user(username,password,name,gender)
        VALUES(
            '${username}',
            '${hashedPassword}',
            '${name}',
            '${gender}'
        )`;
      await db.run(createUser);
      response.send("User created successfully");
    }
  }
});

//POST                              API - 2

app.post("/login", async (request, response) => {
  const { username, password } = request.body;
  const getUserQuery = `SELECT * FROM user WHERE username = '${username}'`;
  const existUser = await db.get(getUserQuery);
  if (existUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(
      password,
      existUser.password
    );
    if (isPasswordMatched === true) {
      const payload = { username: username };
      const jwtToken = jwt.sign(username, "asdfghjkl");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

// GET                      API - 3

app.get("/user/tweets/feed/", authenticateToken, async (request, response) => {
  const { username, user_id } = request;
  const getTweets = `
  SELECT user.username, tweet.tweet, tweet.date_time as dateTime
  FROM 
    follower INNER JOIN tweet ON
    follower.following_user_id = tweet.user_id
    INNER JOIN user ON
    tweet.user_id = user.user_id
  WHERE 
    follower.follower_user_id = ${user_id}
  ORDER BY
    tweet.date_time DESC
  LIMIT 4`;
  const dbResponse = await db.all(getTweets);
  response.send(dbResponse);
});

// GET user following user names   API - 4

app.get("/user/following/", authenticateToken, async (request, response) => {
  const { username, user_id } = request;
  const userFollowingUsernames = `
  SELECT name
  FROM user inner join follower ON
    user.user_id  = follower.following_user_id 
   
  WHERE 
    follower.follower_user_id = ${user_id}
  `;
  const dbResponse = await db.all(userFollowingUsernames);
  response.send(dbResponse);
});

// GET                      API - 5

app.get("/user/followers/", authenticateToken, async (request, response) => {
  const { username, user_id } = request;
  const userFollowingUsernames = `
  SELECT name
  FROM follower left join user ON
    follower.follower_user_id = user.user_id
  WHERE 
    follower.following_user_id = ${user_id}
  `;
  const dbResponse = await db.all(userFollowingUsernames);
  response.send(dbResponse);
});

// GET                      API - 6

app.get("/tweets/:tweetId", authenticateToken, async (request, response) => {
  const { tweetId } = request.params;
  const { username, user_id } = request;
  const tweetsQuery = `
                SELECT *
                FROM tweet
                WHERE 
                  tweet.tweet_id = ${tweetId}`;
  const tweetResults = await db.get(tweetsQuery);

  const userFollowersQuery = `
  SELECT *
  FROM follower INNER JOIN user ON
    follower.following_user_id = user.user_id
  WHERE 
    follower.follower_user_id = ${user_id}`;
  let userFollowers = await db.all(userFollowersQuery);

  if (
    userFollowers.some(
      (item) => item.following_user_id === tweetResults.user_id
    )
  ) {
    const { tweet_id, date_time, tweet } = tweetResults;

    const getLikesQuery = `
    SELECT COUNT(like_id) as likes
    FROM like
    WHERE tweet_id = ${tweet_id} 
    GROUP BY tweet_id`;
    const likesObject = await db.get(getLikesQuery);

    const getRepliesQuery = `
    SELECT COUNT(reply_id) as replies
    FROM reply
    WHERE tweet_id = ${tweetId}
    GROUP BY tweet_id`;
    const repliesObject = await db.get(getRepliesQuery);

    response.send({
      tweet,
      likes: likesObject.likes,
      replies: repliesObject.replies,
      dateTime: date_time,
    });
  } else {
    response.status(401);
    response.send("Invalid Request");
  }
});

//GET LIKES OF tweetId          API - 7

app.get(
  "/tweets/:tweetId/likes/",
  authenticateToken,
  async (request, response) => {
    const { tweetId } = request.params;
    const { username, user_id } = request;
    const userFollowingUsernames = `SELECT name
  FROM follower left join user ON
    follower.following_user_id = user.user_id
  WHERE 
    follower.follower_user_id = ${user_id}`;
    let dbResponseNames = await db.all(userFollowingUsernames);
    dbResponseNames = dbResponseNames.map((each) => each.name);
    console.log(dbResponseNames);
    const getTwittedDetails = `
                  SELECT name
                  FROM tweet inner join user ON
                    tweet.user_id = user.user_id
                  WHERE 
                    tweet.tweet_id = ${tweetId}`;
    const dbResponse = await db.get(getTwittedDetails);
    if (dbResponseNames.includes(dbResponse.name) === false) {
      response.status(401);
      response.send("Invalid Request");
    } else {
      const getLikesQuery = `SELECT user.name
                  FROM like inner join user ON 
                  like.user_id = user.user_id
                  WHERE 
                    like.tweet_id = ${tweetId}`;
      const likesObject = await db.all(getLikesQuery);
      let namesArray = likesObject.map((each) => each.name);
      console.log(namesArray);
      response.send({
        likes: namesArray,
      });
    }
  }
);

//GET REPLIES OF tweetId          API - 8

app.get(
  "/tweets/:tweetId/replies/",
  authenticateToken,
  async (request, response) => {
    const { tweetId } = request.params;
    const { username, user_id } = request;
    const userFollowingUsernames = `SELECT name
  FROM follower left join user ON
    follower.following_user_id = user.user_id
  WHERE 
    follower.follower_user_id = ${user_id}`;
    let dbResponseNames = await db.all(userFollowingUsernames);
    dbResponseNames = dbResponseNames.map((each) => each.name);
    console.log(dbResponseNames);
    const getTwittedDetails = `
                  SELECT name
                  FROM tweet inner join user ON
                    tweet.user_id = user.user_id
                  WHERE 
                    tweet.tweet_id = ${tweetId}`;
    const dbResponse = await db.get(getTwittedDetails);
    if (dbResponseNames.includes(dbResponse.name) === false) {
      response.status(401);
      response.send("Invalid Request");
    }
  }
);

//GET ALL TWEETS          API - 9

app.get("/user/tweets/", authenticateToken, async (request, response) => {
  const { username, user_id } = request;

  const tweetsQuery = `
                SELECT *
                FROM tweet
                WHERE 
                  tweet.user_id = '${user_id}'`;
  const tweetResults = await db.get(tweetsQuery);
  const { tweet, date_time } = tweetResults;

  const getLikesQuery = `
    SELECT COUNT(like_id) as likes
    FROM like
    WHERE like.user_id = '${user_id}'`;
  const likesObject = await db.get(getLikesQuery);

  const getRepliesQuery = `
    SELECT COUNT(reply_id) as replies
    FROM reply
    WHERE reply.user_id = '${user_id}'
    GROUP BY tweet_id`;
  const repliesObject = await db.get(getRepliesQuery);

  response.send({
    tweet,
    likes: likesObject.likes,
    replies: repliesObject.replies,
    dateTime: date_time,
  });
});

//POST create new tweet             API - 10

app.post("/user/tweets/", authenticateToken, async (request, response) => {
  const { tweet } = request.body;
  const createNewTweet = `
        INSERT INTO tweet(tweet)
        VALUES(
            '${tweet}'
        )`;
  const dbResponse = await db.run(createNewTweet);
  response.send("Created a Tweet");
});

//DELETE TWEET by tweetId          API - 11

app.delete(
  "/tweets/:tweetId/",
  authenticateToken,
  async (request, response) => {
    const { tweetId } = request.params;
    const { username, user_id } = request;
    const getTwittedDetails = `
                  SELECT tweet.tweet_id as id
                  FROM tweet inner join user ON
                    tweet.user_id = user.user_id
                WHERE
                  user.username = '${username}'`;
    const dbResponse = await db.all(getTwittedDetails);
    const responseArray = dbResponse.map((each) => each.id);
    if (responseArray.includes(parseInt(tweetId)) === false) {
      response.status(401);
      response.send("Invalid Request");
    } else {
      const deleteTweet = `
        DELETE FROM tweet
        WHERE tweet_id = ${tweetId}`;
      await db.run(deleteTweet);
      response.send("Tweet Removed");
    }
  }
);
