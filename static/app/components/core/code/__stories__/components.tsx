import {useState} from 'react';

import {CodeBlock} from '@sentry/scraps/code';

import {addSuccessMessage} from 'sentry/actionCreators/indicator';

export function OnTabClickExample() {
  const [tab, setTab] = useState('npm');
  function handleTabClick(t: string) {
    setTab(t);
    addSuccessMessage('Clicked a different tab');
  }

  return (
    <CodeBlock
      tabs={[
        {label: 'npm', value: 'npm'},
        {label: 'Yarn', value: 'yarn'},
      ]}
      selectedTab={tab}
      onTabClick={handleTabClick}
      language="bash"
    >
      {tab === 'npm' ? 'npm install --save @sentry/browser' : 'yarn add @sentry/browser'}
    </CodeBlock>
  );
}
