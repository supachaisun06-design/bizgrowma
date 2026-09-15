import { defineConfig } from 'astro/config';
import node from '@astrojs/node';

export default defineConfig({
  site: 'https://it-outsource.bizgrowtech.com',
  output: 'hybrid',
  adapter: node({ mode: 'standalone' }),
});
