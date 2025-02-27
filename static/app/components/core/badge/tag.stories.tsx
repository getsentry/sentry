import {Fragment, useState} from 'react';

import {Button} from 'sentry/components/button';
import {Tag} from 'sentry/components/core/badge/tag';
import JSXNode from 'sentry/components/stories/jsxNode';
import JSXProperty from 'sentry/components/stories/jsxProperty';
import SizingWindow from 'sentry/components/stories/sizingWindow';
import {IconCheckmark, IconFire, IconSentry} from 'sentry/icons';
import storyBook from 'sentry/stories/storyBook';
import useDismissAlert from 'sentry/utils/useDismissAlert';

// eslint-disable-next-line import/no-webpack-loader-syntax
import types from '!!type-loader!sentry/components/core/badge/tag.tsx';

export default storyBook('Tag', (story, APIReference) => {
  APIReference(types.Tag);
  story('Default', () => {
    return (
      <Fragment>
        <p>
          The <JSXNode name="Tag" /> component is a pill-shaped badge. Depending on the{' '}
          <JSXProperty name="type" value /> prop specified, it can be used as a success
          indicator, an error or warning indidcator, and for various other use cases.
        </p>
        <p>
          The default <JSXNode name="Tag" /> looks like this, with{' '}
          <JSXProperty name="type" value="default" />:
        </p>
        <Tag>Default tag</Tag>
      </Fragment>
    );
  });

  story('type', () => {
    return (
      <Fragment>
        <p>
          The <JSXProperty name="type" value /> prop specifies the tag category, and
          changes the color of the tag.
        </p>
        <SizingWindow display="block">
          <Tag type="default">Default</Tag>
          <Tag type="success">Success</Tag>
          <Tag type="error">Error</Tag>
          <Tag type="warning">Warning</Tag>
          <Tag type="info">Info</Tag>
          <Tag type="black">Black</Tag>
          <Tag type="white">White</Tag>
          <Tag type="promotion">Promotion</Tag>
          <Tag type="highlight">Highlight</Tag>
        </SizingWindow>
      </Fragment>
    );
  });

  story('icon', () => {
    return (
      <Fragment>
        <p>
          The <JSXProperty name="icon" value /> prop can be specified if you want to add
          an icon to the tag. Just directly pass in the icon, like{' '}
          <JSXNode name="IconSentry" /> for example, to the prop.
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

  story('textMaxWidth', () => {
    return (
      <Fragment>
        <p>
          The <JSXProperty name="textMaxWidth" value /> prop specifies when the tag should
          start text overflowing. By default,{' '}
          <JSXProperty name="textMaxWidth" value={150} />.
        </p>
        <Tag type="promotion">Long text will get cut off like this</Tag>
        <p>But you can change this value to be shorter or longer:</p>
        <Tag type="promotion" textMaxWidth={30}>
          Small tag
        </Tag>
        <br />
        <br />
        <Tag type="promotion" textMaxWidth={500}>
          This is what happens when you have really long text but you increase the max
          text width
        </Tag>
      </Fragment>
    );
  });

  story('tooltip', () => {
    return (
      <Fragment>
        <p>
          The <JSXProperty name="tooltipText" value /> and{' '}
          <JSXProperty name="tooltipProps" value /> props allow you to specify a tooltip
          and any custom props you want to pass in. This is helpful to have if your tag
          text overflows!
        </p>
        <Tag
          type="info"
          tooltipProps={{
            title:
              'Long text will get cut off like this, but thankfully we have this handy tooltip',
          }}
        >
          Long text will get cut off like this, but thankfully we have this handy tooltip
        </Tag>
        <p>
          All the typical <code>Tooltip</code> props, like <code>position</code>, apply
          here:
        </p>
        <Tag
          type="info"
          tooltipProps={{
            position: 'right',
            title: 'This one has `position: right` specified',
          }}
        >
          Tooltip on the right
        </Tag>
      </Fragment>
    );
  });

  story('onDismiss', () => {
    const LOCAL_STORAGE_KEY = 'tag-stories-tag-dismissed';
    const {dismiss, isDismissed} = useDismissAlert({key: LOCAL_STORAGE_KEY});
    const [stateDismissed, setStateDismissed] = useState(false);
    return (
      <Fragment>
        <p>
          You can make your tag dismissible too, by passing something into the{' '}
          <JSXProperty name="onDismiss" value /> prop.
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
