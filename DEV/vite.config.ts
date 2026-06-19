import { defineConfig } from 'vite';
 
 export default defineConfig(({ command, mode, isSsrBuild }) => {
  console.log(command, mode, isSsrBuild);
  
  return {
    base: mode == 'production' ? "/mac/" : "/",
    server: {
      port: 340,
      open: true,
    }
  }
});