import "reflect-metadata";
import { createConnection } from "typeorm";
import express from "express";
import Redis from "ioredis";
import session from "express-session";
import connectRedis from "connect-redis";
import cors from "cors";
import { ApolloServer } from "apollo-server-express";
import { buildSchema } from "type-graphql";
import { PostResolver } from "./resolvers/post";
import { UserResolver } from "./resolvers/user";
import { MyContext } from "./types";
import { COOKIE_NAME } from "./constants";
import { Post } from "./entities/Post";
import { User } from "./entities/User";
import { Upvote } from "./entities/Upvote";

const main = async () => {
	await createConnection({
		type: "postgres",
		database: "blogbackend",
		username: "dev",
		password: "utytpbc",
		logging: true,
		synchronize: true,
		entities: [Post, User, Upvote],
	});

	const app = express();

	app.use(
		cors({
			origin: "http://localhost:3000",
			credentials: true,
		})
	);

	// Connect Redis
	const RedisStore = connectRedis(session);
	const redis = new Redis();

	app.use(
		session({
			name: COOKIE_NAME,
			store: new RedisStore({ client: redis, disableTouch: true }),
			secret: "ieqkncxuyqwpxxzwqepm",
			resave: false,
			saveUninitialized: false,
			cookie: {
				maxAge: 1000 * 60 * 60 * 24 * 365, // 1 year I hope
				httpOnly: true,
				secure: false, // let cookie works without http,
				sameSite: "lax", // csrf
			},
		})
	);

	// Connect Graphql
	const apolloServer = new ApolloServer({
		schema: await buildSchema({
			resolvers: [PostResolver, UserResolver],
			validate: false,
		}),
		context: ({ req, res }): MyContext => ({ req, res, redis }),
	});

	apolloServer.applyMiddleware({
		app,
		cors: false,
	});

	app.listen(4000, () => {
		console.log("SERVER RUNNING");
	});
};

main().catch((e) => {
	console.log(e);
});
