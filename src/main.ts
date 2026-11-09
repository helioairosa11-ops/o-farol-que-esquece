import './ui/styles.css';
import { FarolGameApp } from './ui/game-app';

const appRoot = document.getElementById('app');
if (appRoot) {
  new FarolGameApp(appRoot);
}
