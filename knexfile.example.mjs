export default {
  development: {
    client: 'pg',
    connection: {
      host: 'localhost',
      port: 5432,
      user: 'user',
      password: 'password',
      database: 'sensibo',
    },
    migrations: {
      // important!
      loadExtensions: ['.mjs'],
    },
  },
}
