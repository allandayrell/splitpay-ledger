import { defineConfig, globalIgnores } from 'eslint/config';
import tseslint from 'typescript-eslint';

export default defineConfig(
  globalIgnores(['coverage/', 'dist/', 'dist-ssr/', 'plans/', 'playwright-report/', 'test-results/']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [tseslint.configs.recommended],
  },
);
