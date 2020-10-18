import { PROD } from "./constants";
import { Post } from "./entities/Post";
import { MikroORM } from "@mikro-orm/core";
import path from "path";

export default {
  migrations: {
    path: path.join(__dirname, "./migrations"), // path to the folder with migrations
    pattern: /^[\w-]+\d+\.[tj]s$/, // regex pattern for the migration files
  },
  dbName: "blogerbackend",
  user: "dev",
  password: "utytpbc",
  debug: !PROD,
  type: "postgresql",
  entities: [Post],
} as Parameters<typeof MikroORM.init>[0];
