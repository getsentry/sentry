import {Fragment, useState} from 'react';

import {Button} from 'sentry/components/button';
import {Alert} from 'sentry/components/core/alert';
import ExternalLink from 'sentry/components/links/externalLink';
import JSXNode from 'sentry/components/stories/jsxNode';
import JSXProperty from 'sentry/components/stories/jsxProperty';
import SizingWindow from 'sentry/components/stories/sizingWindow';
import {IconClose, IconDelete, IconSad, IconSentry, IconStar} from 'sentry/icons';
import storyBook from 'sentry/stories/storyBook';

// eslint-disable-next-line import/no-webpack-loader-syntax
import types from '!!type-loader!sentry/components/alert';

export default storyBook('Alert', (story, APIReference) => {
  APIReference(types.Alert);
  story('Default', () => {
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
        <Alert type="info">Sentry is cool!!</Alert>
        <p>
          You can even add in links, which will be nicely formatted for you inside the
          alert:
        </p>
        <Alert type="info">
          Sentry is cool!{' '}
          <ExternalLink href="https://sentry.io/welcome/">Learn more here.</ExternalLink>
        </Alert>
      </Fragment>
    );
  });

  story('type', () => {
    return (
      <Fragment>
        <p>
          The <JSXProperty name="type" value /> prop specifies the alert category, and
          changes the color and default icon of the alert.
        </p>
        <Alert.Container>
          <Alert type="error" showIcon>
            This is an error alert. Something went wrong.
          </Alert>
          <Alert type="info" showIcon>
            Info alert. Put some exciting info here.
          </Alert>
          <Alert type="muted" showIcon>
            Muted alerts look like this.
          </Alert>
          <Alert type="success" showIcon>
            Success alert. Yay!
          </Alert>
          <Alert type="warning" showIcon>
            Warning alert. Something is about to go wrong, probably.
          </Alert>
        </Alert.Container>
      </Fragment>
    );
  });

  story('icon', () => {
    return (
      <Fragment>
        <p>
          The <JSXProperty name="icon" value /> prop can be changed if you want to
          customize the default icon. Just directly pass in the icon, like{' '}
          <JSXNode name="IconDelete" /> for example, to the prop.
        </p>
        <Alert.Container>
          <Alert type="warning" showIcon icon={<IconDelete />}>
            Are you sure you want to delete?
          </Alert>
          <Alert type="error" showIcon icon={<IconSad />}>
            Oh no!
          </Alert>
        </Alert.Container>
      </Fragment>
    );
  });

  story('opaque', () => {
    return (
      <Fragment>
        <p>
          The <JSXProperty name="opaque" value /> prop is a boolean that's{' '}
          <code>false</code> by default.
        </p>
        <SizingWindow display="block">
          <Alert.Container>
            <Alert type="success" showIcon opaque>
              This one is opaque.
            </Alert>
            <Alert type="success" showIcon>
              This is not opaque.
            </Alert>
          </Alert.Container>
        </SizingWindow>
      </Fragment>
    );
  });

  story('expand', () => {
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

  story('trailingItems', () => {
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

        {stateDismissed ? null : (
          <Alert.Container>
            <Alert
              type="info"
              showIcon
              icon={<IconSentry />}
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

  story('Alert.Container', () => {
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
