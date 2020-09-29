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
    const [isShared, setShared] = useState(false);
    const [loading, setLoading] = useState(false);

    function toggleShare() {
      toggleAction();
      setLoading(true);
      setTimeout(() => {
        setShared(!isShared);
        setLoading(false);
      }, 1000);
    }

    return <div {...props}>{children({isShared, loading, toggleShare})}</div>;
  }

  return (
    <Parent>
      {({isShared, loading, toggleShare}) => (
        <ShareIssue
          loading={loading}
          isShared={isShared}
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
