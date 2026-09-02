module.exports = {
  apps: [
    {
      name: 'ligao-559-apartelle',
      script: './dist/server/entry.mjs',
      interpreter: 'node',
      cwd: '/var/www/jpaworx.com/ligao-559-apartelle',

      // Environment
      env: {
        NODE_ENV: 'production',
        HOST: '0.0.0.0',
        PORT: 5990,
        // Set COOKIE_SECURE=true only when serving over HTTPS (e.g. behind Nginx with SSL).
        // Leave as 'false' when serving over plain HTTP — otherwise the login cookie
        // will be silently dropped by the browser and you won't be able to log in.
        COOKIE_SECURE: 'true',
        // Uncomment and set a strong random secret before deploying:
        SESSION_SECRET: 'f3g4cvty35b6uj6tw3cw6ahWEg5etbu',
      },

      // Restart policy
      autorestart: true,
      watch: false,
      max_restarts: 10,
      restart_delay: 2000,
      min_uptime: '5s',

      // Logging
      out_file: './logs/out.log',
      error_file: './logs/error.log',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',

      // Graceful shutdown
      kill_timeout: 5000,
      wait_ready: false,
    },
  ],
};
