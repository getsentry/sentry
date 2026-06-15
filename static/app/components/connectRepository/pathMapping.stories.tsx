import {useState} from 'react';

import {PathMapping} from 'sentry/components/connectRepository/pathMapping';
import * as Storybook from 'sentry/stories';

export default Storybook.story('PathMapping', story => {
  story('New (editing)', () => {
    const [value, setValue] = useState({
      stackRoot: '',
      sourceRoot: '',
      branch: '',
    });

    return (
      <PathMapping
        {...value}
        editing
        isNew
        onChange={setValue}
        onDelete={() => {}}
        onExpandToggle={() => {}}
      />
    );
  });

  story('Collapsed existing', () => {
    const [editing, setEditing] = useState(false);
    const [value, setValue] = useState({
      stackRoot: 'app/',
      sourceRoot: 'static/app/',
      branch: 'main',
    });

    return (
      <PathMapping
        {...value}
        editing={editing}
        isNew={false}
        onChange={setValue}
        onDelete={() => {}}
        onExpandToggle={() => setEditing(current => !current)}
      />
    );
  });

  story('Editing existing', () => {
    const [editing, setEditing] = useState(true);
    const [value, setValue] = useState({
      stackRoot: 'app/',
      sourceRoot: 'static/app/',
      branch: 'main',
    });

    return (
      <PathMapping
        {...value}
        editing={editing}
        isNew={false}
        onChange={setValue}
        onDelete={() => {}}
        onExpandToggle={() => setEditing(current => !current)}
      />
    );
  });
});
