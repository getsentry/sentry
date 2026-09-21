import {useState} from 'react';

import {CodeBlock} from '@sentry/scraps/code';
import {toast} from '@sentry/scraps/toast';

export function OnTabClickExample() {
  const [tab, setTab] = useState('npm');
  function handleTabClick(t: string) {
    setTab(t);
    toast.success('Clicked a different tab');
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
