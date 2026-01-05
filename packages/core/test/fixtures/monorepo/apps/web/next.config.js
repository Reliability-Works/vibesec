module.exports = {
  productionBrowserSourceMaps: true,
  poweredByHeader: true,
  reactStrictMode: false,
  compress: false,
  assetPrefix: 'http://cdn.example.com',
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    dangerouslyAllowSVG: true,
    domains: ['*'],
    remotePatterns: [{ protocol: 'http', hostname: '**' }],
  },
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Credentials', value: 'true' },
          { key: 'Access-Control-Allow-Headers', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: '*' },
        ],
      },
    ]
  },
}
