import { Bootstrap } from './app/Bootstrap';
import { ControlTowerShell } from './app/ControlTowerShell';

function App() {
  return <Bootstrap>{(context) => <ControlTowerShell context={context} />}</Bootstrap>;
}

export default App;
