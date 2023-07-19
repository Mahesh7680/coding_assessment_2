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
  const { username } = request;
  const dbUser = `SELECT * FROM user WHERE username = '${username}'`;
  const dbUserResponse = await db.get(dbUser);
  const getTweets = `
  SELECT user.username, tweet.tweet, tweet.date_time as dateTime
  FROM 
    follower INNER JOIN tweet ON
    follower.following_user_id = tweet.user_id
    INNER JOIN user ON
    tweet.user_id = user.user_id
  WHERE 
    follower.follower_user_id = ${dbUserResponse.user_id}
  ORDER BY
    tweet.date_time DESC
  LIMIT 4`;
  const dbResponse = await db.all(getTweets);
  response.send(dbResponse);
});

// GET                      API - 4

app.get("/user/following/", authenticateToken, async (request, response) => {
  const { username } = request;
  const dbUser = `SELECT * FROM user WHERE username = '${username}'`;
  const dbUserResponse = await db.get(dbUser);
  const userFollowingUsernames = `
  SELECT *
  FROM follower left join user ON
    follower.follower_user_id = user.user_id
   
  WHERE 
    user.user_id = ${dbUserResponse.user_id}
  `;
  const dbResponse = await db.all(userFollowingUsernames);
  console.log(dbResponse);
  response.send(dbResponse);
});

// GET                      API - 5

app.get("/user/followers/", authenticateToken, async (request, response) => {
  const { username } = request;
  const dbUser = `SELECT * FROM user WHERE username = '${username}'`;
  const dbUserResponse = await db.get(dbUser);
  const userFollowingUsernames = `
  SELECT *
  FROM follower left join user ON
    follower.follower_user_id = user.user_id
   
  WHERE 
    user.user_id = ${dbUserResponse.user_id}
  `;
  const dbResponse = await db.all(userFollowingUsernames);
  console.log(dbResponse);
  response.send(dbResponse);
});

// GET                      API - 6

app.get("/tweets/:tweetId", authenticateToken, async (request, response) => {
  const { tweetId } = request.params;
});
