import {Fragment, useState} from 'react';

import {Button} from 'sentry/components/button';
import {Alert, type AlertProps} from 'sentry/components/core/alert';
import JSXNode from 'sentry/components/stories/jsxNode';
import JSXProperty from 'sentry/components/stories/jsxProperty';
import {IconClose, IconSentry, IconStar} from 'sentry/icons';
import StoryBook from 'sentry/stories/storyBook';
import useDismissAlert from 'sentry/utils/useDismissAlert';

// eslint-disable-next-line import/no-webpack-loader-syntax
import types from '!!type-loader!sentry/components/core/alert';

const ALERT_VARIANTS: Array<AlertProps['type']> = [
  'info',
  'warning',
  'success',
  'error',
  'muted',
];

const RECOMMENDED_USAGE: Partial<AlertProps> = {
  showIcon: true,
};

export default StoryBook('Alert', Story => {
  Story.APIReference(types.Alert);
  Story('Default', () => {
    return (
      <Fragment>
        <p>
          The <JSXNode name="Alert" /> component is a highlighted banner that can include
          text, links, and more. Depending on the <JSXProperty name="type" value /> prop
          specified, it can be used as a success banner, an error or warning message, and
          for various other use cases. It can be made dismissible as well.
        </p>
        <p>
          The default <JSXNode name="Alert" /> looks like this:
        </p>
        <Alert.Container>
          {ALERT_VARIANTS.map(variant => (
            <Alert key={variant} type={variant} {...RECOMMENDED_USAGE}>
              Sentry {variant} alert...
            </Alert>
          ))}
        </Alert.Container>
      </Fragment>
    );
  });

  Story('System', () => {
    return (
      <Fragment>
        <p>System alerts are used for important messages that are not dismissible.</p>
        <Alert.Container>
          {ALERT_VARIANTS.map(variant => (
            <Alert key={variant} type={variant} {...RECOMMENDED_USAGE} system>
              Sentry Alert...
            </Alert>
          ))}
        </Alert.Container>
      </Fragment>
    );
  });

  Story('Expandable Alerts', () => {
    return (
      <Fragment>
        <p>
          The <JSXProperty name="expand" value /> and{' '}
          <JSXProperty name="defaultExpanded" value /> props can be used to show
          additional content when the alert is expanded.
        </p>
        <Alert.Container>
          <Alert type="info" showIcon expand="Some extra info here.">
            Expand me
          </Alert>
          <Alert type="info" showIcon defaultExpanded expand="Some extra info here.">
            This one is expanded by default.
          </Alert>
        </Alert.Container>
      </Fragment>
    );
  });

  Story('Without icon and custom trailing items', () => {
    return (
      <Fragment>
        <p>
          The <JSXProperty name="showIcon" value /> and{' '}
          <JSXProperty name="trailingItems" value /> props can be used to customize the
          alert.
        </p>
        <Alert.Container>
          <Alert type="info" showIcon={false} trailingItems={<IconStar />}>
            This alert has no icon and a custom trailing item.
          </Alert>
        </Alert.Container>
      </Fragment>
    );
  });

  Story('Dismissible Alerts', () => {
    const LOCAL_STORAGE_KEY = 'alert-stories-banner-dismissed';
    const {dismiss, isDismissed} = useDismissAlert({key: LOCAL_STORAGE_KEY});
    const [stateDismissed, setStateDismissed] = useState(false);

    return (
      <Fragment>
        <p>
          The <JSXProperty name="trailingItems" value /> prop can be used to customize the
          item at the far right of the alert. One great use case is making the alert
          dismissible! You can pair it with a hook like <code>useDismissAlert</code> to
          enable this functionality with local storage. Or you can use{' '}
          <code>useState</code> to bring it back on re-render.
        </p>

        {isDismissed ? null : (
          <Alert.Container>
            <Alert
              type="info"
              showIcon
              icon={<IconSentry />}
              trailingItems={
                <Button
                  aria-label="Dismiss banner"
                  icon={<IconClose />}
                  onClick={dismiss}
                  size="zero"
                  borderless
                />
              }
            >
              This alert can be dismissed!
            </Alert>
          </Alert.Container>
        )}
        {stateDismissed ? (
          <Button onClick={() => setStateDismissed(false)}>Bring the alert back</Button>
        ) : (
          <Alert
            type="info"
            showIcon
            icon={<IconStar />}
            trailingItems={
              <Button
                aria-label="Dismiss banner"
                icon={<IconClose />}
                onClick={() => setStateDismissed(true)}
                size="zero"
                borderless
              />
            }
          >
            Try dismissing this one
          </Alert>
        )}
      </Fragment>
    );
  });

  Story('Alert.Container', () => {
    return (
      <Fragment>
        <p>
          The <JSXNode name="Alert" /> component is marginless by default. The{' '}
          <JSXNode name="Alert.Container" /> component is an exported wrapper in the same
          file that adds the original bottom margin back in, and also automatically spaces
          all items within the container evenly.
        </p>
        <Alert.Container>
          <Alert type="info" showIcon>
            These two alerts...
          </Alert>
          <Alert type="info" showIcon>
            ...are both in one container.
          </Alert>
        </Alert.Container>
      </Fragment>
    );
  });
});
