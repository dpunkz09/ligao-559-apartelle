module.exports = {
  apps: [
    {
      name: 'ligao-559-apartelle',
      script: './dist/server/entry.mjs',
      interpreter: 'node',

      // Environment
      env: {
        NODE_ENV: 'production',
        HOST: '0.0.0.0',
        PORT: 559,
        // Set a strong random secret before deploying:
        // SESSION_SECRET: 'your-strong-random-secret-here',
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
