import {Fragment, useState} from 'react';

import {Tag} from 'sentry/components/core/badge/tag';
import {Button} from 'sentry/components/core/button';
import {IconCheckmark, IconFire, IconSentry} from 'sentry/icons';
import * as Storybook from 'sentry/stories';
import useDismissAlert from 'sentry/utils/useDismissAlert';

import types from '!!type-loader!sentry/components/core/badge/tag.tsx';

export default Storybook.story('Tag', (story, APIReference) => {
  APIReference(types.Tag);
  story('Default', () => {
    return (
      <Fragment>
        <p>
          The <Storybook.JSXNode name="Tag" /> component is a pill-shaped badge. Depending
          on the <Storybook.JSXProperty name="type" value /> prop specified, it can be
          used as a success indicator, an error or warning indicator, and for various
          other use cases.
        </p>
        <Storybook.SizingWindow display="block">
          <Tag type="default">Default</Tag>
          <Tag type="success">Success</Tag>
          <Tag type="error">Error</Tag>
          <Tag type="warning">Warning</Tag>
          <Tag type="info">Info</Tag>
          <Tag type="promotion">Promotion</Tag>
          <Tag type="highlight">Highlight</Tag>
        </Storybook.SizingWindow>
      </Fragment>
    );
  });
  story('icon', () => {
    return (
      <Fragment>
        <p>
          The <Storybook.JSXProperty name="icon" value /> prop can be specified if you
          want to add an icon to the tag. Just directly pass in the icon, like{' '}
          <Storybook.JSXNode name="IconSentry" /> for example, to the prop.
        </p>
        <Tag type="warning" icon={<IconSentry />}>
          Example
        </Tag>
        <Tag type="error" icon={<IconFire />}>
          Error
        </Tag>
        <Tag type="success" icon={<IconCheckmark />}>
          Nice
        </Tag>
      </Fragment>
    );
  });

  story('Dismissable tags', () => {
    const LOCAL_STORAGE_KEY = 'tag-stories-tag-dismissed';
    const {dismiss, isDismissed} = useDismissAlert({key: LOCAL_STORAGE_KEY});
    const [stateDismissed, setStateDismissed] = useState(false);
    return (
      <Fragment>
        <p>
          You can make your tag dismissible too, by passing into the{' '}
          <Storybook.JSXProperty name="onDismiss" value /> prop.
        </p>
        {isDismissed ? null : (
          <Tag type="warning" onDismiss={dismiss}>
            Dissmis this forever
          </Tag>
        )}
        <br />
        <br />
        {stateDismissed ? (
          <Button onClick={() => setStateDismissed(false)}>Bring the tag back</Button>
        ) : (
          <Tag type="info" onDismiss={() => setStateDismissed(true)}>
            Try dismissing this one
          </Tag>
        )}
        <br />
        <br />
      </Fragment>
    );
  });
});
