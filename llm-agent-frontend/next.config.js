/** @type {import('next').NextConfig} */
const nextConfig = {
  // Webpack yapılandırması
  webpack: (config, { isServer }) => {
    // Modül çözümleme sorunlarını önle
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
      crypto: false,
    };

    // Client-side only modüller için
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
      };
    }

    return config;
  },

  // React strict mode'u aç
  reactStrictMode: true,

  // TypeScript kontrolünü devre dışı bırak (geliştirme sırasında)
  typescript: {
    ignoreBuildErrors: true,
  },

  // ESLint kontrolünü devre dışı bırak (geliştirme sırasında)
  eslint: {
    ignoreDuringBuilds: true,
  },

  // Compiler ayarları
  compiler: {
    removeConsole: false,
  },
};

module.exports = nextConfig;