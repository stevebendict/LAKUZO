import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // TypeScript errors are still ignored here
  typescript: {
    ignoreBuildErrors: true,
  },

  

  webpack: (config) => {
    config.externals.push("pino-pretty", "lokijs", "encoding");

    config.resolve.alias = {
      ...config.resolve.alias,
      '@react-native-async-storage/async-storage': false,
    };

    return config;
  },
};

export default nextConfig;
