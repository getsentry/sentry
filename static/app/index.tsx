import {bootstrap} from 'app/bootstrap';
import {initializeMain} from 'app/bootstrap/initializeMain';

async function app() {
  const data = await bootstrap();
  initializeMain(data);
}

app();
