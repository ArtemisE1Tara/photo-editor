/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        // Apply these headers to all routes
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: `
              default-src 'self';
              script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.googleapis.com https://*.gstatic.com https://accounts.google.com;
              style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
              font-src 'self' https://fonts.gstatic.com;
              img-src 'self' blob: data: https://*.googleusercontent.com https://*.googleapis.com;
              connect-src 'self' https://*.googleapis.com https://accounts.google.com;
              frame-src https://accounts.google.com https://*.googleusercontent.com;
            `.replace(/\s+/g, ' ').trim(),
          }
        ],
      },
    ];
  },
  images: {
    unoptimized: true, // This disables image optimization completely
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.googleusercontent.com',
        port: '',
        pathname: '**',
      },
      {
        protocol: 'https',
        hostname: '**.googleapis.com',
        port: '',
        pathname: '**',
      }
    ]
  },
  reactStrictMode: true,
}

module.exports = nextConfig
