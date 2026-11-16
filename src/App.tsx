import { useState } from 'react';
import type { Game } from './game/model';
import { Home } from './screens/Home';
import { Setup } from './screens/Setup';
import { SheetScreen } from './screens/SheetScreen';
import { saveGame } from './storage/db';

type Screen = { name: 'home' } | { name: 'setup' } | { name: 'sheet'; game: Game };

export default function App() {
  const [screen, setScreen] = useState<Screen>({ name: 'home' });

  switch (screen.name) {
    case 'home':
      return <Home onNewGame={() => setScreen({ name: 'setup' })} onOpen={(game) => setScreen({ name: 'sheet', game })} />;
    case 'setup':
      return (
        <Setup
          onCancel={() => setScreen({ name: 'home' })}
          onStart={async (game) => {
            await saveGame(game);
            setScreen({ name: 'sheet', game });
          }}
        />
      );
    case 'sheet':
      return <SheetScreen initialGame={screen.game} onExit={() => setScreen({ name: 'home' })} />;
  }
}
