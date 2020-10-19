import "reflect-metadata";
import express from "express";
import redis from "redis";
import session from "express-session";
import connectRedis from "connect-redis";
import cors from "cors";
import mickroConfig from "./mikro-orm.config";
import { ApolloServer } from "apollo-server-express";
import { MikroORM } from "@mikro-orm/core";
import { buildSchema } from "type-graphql";
import { HelloResolver } from "./resolvers/hello";
import { PostResolver } from "./resolvers/post";
import { UserResolver } from "./resolvers/user";
import { MyContext } from "./types";

const main = async () => {
	const orm = await MikroORM.init(mickroConfig);
	// Run migrations
	await orm.getMigrator().up();

	const app = express();

	app.use(
		cors({
			origin: "http://localhost:3000",
			credentials: true,
		})
	);

	// Connect Redis
	const RedisStore = connectRedis(session);
	const redisClient = redis.createClient();

	app.use(
		session({
			name: "qid",
			store: new RedisStore({ client: redisClient, disableTouch: true }),
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
			resolvers: [HelloResolver, PostResolver, UserResolver],
			validate: false,
		}),
		context: ({ req, res }): MyContext => ({ em: orm.em, req, res }),
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
