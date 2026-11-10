import './style.css';
import { App } from './app/App';

const app = new App();
const ready = app.init();
void ready.catch((error) => {
  console.error(error);
});

// Available immediately so screenshot tooling can wait for the scene instead of
// racing the module load. Named states are applied once init resolves.
window.__THREE_GAME_TEST_HOOKS__ = {
  setState: async (name) => {
    await ready;
    return app.setState(name);
  },
  setPausedForScreenshot: (paused) => app.setPaused(paused),
  seed: (value) => ({ seed: value }),
};
