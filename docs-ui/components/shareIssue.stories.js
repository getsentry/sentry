// eslint-disable-next-line sentry/no-react-hooks
import React, {useState} from 'react';
import {action} from '@storybook/addon-actions';
import {text} from '@storybook/addon-knobs';
import {withInfo} from '@storybook/addon-info';

import ShareIssue from 'app/components/shareIssue';

export default {
  title: 'Features/Issues/Share Issue',
};

export const Default = withInfo('todo')(() => {
  const toggleAction = action('Toggle');

  function Parent({children, ...props}) {
    const [isSharing, setSharing] = useState(false);
    const [isBusy, setBusy] = useState(false);

    function toggleShare() {
      toggleAction();
      setBusy(true);
      setTimeout(() => {
        setBusy(false);
        setSharing(!isSharing);
      }, 1000);
    }

    return <div {...props}>{children({isSharing, isBusy, toggleShare})}</div>;
  }

  return (
    <Parent>
      {({isSharing, isBusy, toggleShare}) => (
        <ShareIssue
          isBusy={isBusy}
          isShared={isSharing}
          shareUrl={text(
            'shareUrl',
            'https://sentry.io/share/issue/veryveryverylongurl/'
          )}
          onToggle={toggleShare}
          onReshare={action('Reshare')}
        />
      )}
    </Parent>
  );
});

Default.story = {
  name: 'default',
};
