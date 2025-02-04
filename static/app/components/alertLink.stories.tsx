import {Fragment, useState} from 'react';

import AlertLink from 'sentry/components/alertLink';
import JSXNode from 'sentry/components/stories/jsxNode';
import JSXProperty from 'sentry/components/stories/jsxProperty';
import {IconSentry} from 'sentry/icons';
import storyBook from 'sentry/stories/storyBook';

export default storyBook('AlertLink', story => {
  story('Default', () => {
    return (
      <Fragment>
        <p>
          The <JSXNode name="AlertLink" /> component is a highlighted banner that links to
          some other page (or component). Depending on the{' '}
          <JSXProperty name="priority" value /> prop specified, it can be used as a
          success alert, an error or warning alert, and for various other use cases.
        </p>
        <p>
          The default <JSXNode name="AlertLink" /> looks like this:
        </p>
        <AlertLink href="https://sentry.io/welcome">
          Clicking this link will not open in a new tab!
        </AlertLink>
        <p>
          The default props are <JSXProperty name="size" value="normal" />,{' '}
          <JSXProperty name="priority" value="warning" />,{' '}
          <JSXProperty name="withoutMarginBottom" value="false" />, and{' '}
          <JSXProperty name="openInNewTab" value="false" />.
        </p>
        <p>
          This alert below has <JSXProperty name="openInNewTab" value="true" />:
        </p>
        <AlertLink href="https://sentry.io/welcome" openInNewTab>
          Clicking this link WILL open in a new tab!
        </AlertLink>
      </Fragment>
    );
  });

  story('priority', () => {
    return (
      <Fragment>
        <p>
          The <JSXProperty name="priority" value /> prop specifies the alert category, and
          changes the color of the alert.
        </p>
        <AlertLink priority="error">
          This is an error alert. Something went wrong.
        </AlertLink>
        <AlertLink priority="info">Info alert. Put some exciting info here.</AlertLink>
        <AlertLink priority="muted">Muted alerts look like this.</AlertLink>
        <AlertLink priority="success">Success alert. Yay!</AlertLink>
        <AlertLink priority="warning">
          Warning alert. Something is about to go wrong, probably.
        </AlertLink>
      </Fragment>
    );
  });

  story('icon', () => {
    return (
      <Fragment>
        <p>
          The <JSXProperty name="icon" value /> prop can be specified if you want to add
          an icon to the alert. Just directly pass in the icon, like{' '}
          <JSXNode name="IconSentry" /> for example, to the prop.
        </p>
        <AlertLink priority="warning" icon={<IconSentry />}>
          Read the docs.
        </AlertLink>
      </Fragment>
    );
  });

  story('system', () => {
    return (
      <Fragment>
        <p>
          The <JSXProperty name="system" value /> prop is a boolean that's{' '}
          <code>false</code> by default.
        </p>
        <AlertLink>The default style.</AlertLink>
        <AlertLink system>This is in the system style.</AlertLink>
      </Fragment>
    );
  });

  story('withoutMarginBottom', () => {
    return (
      <Fragment>
        <p>
          The <JSXProperty name="withoutMarginBottom" value /> prop is a boolean that's{' '}
          <code>false</code> by default.
        </p>
        <AlertLink withoutMarginBottom>This one has no bottom margin.</AlertLink>
        <AlertLink>This one has bottom margin by default.</AlertLink>
        <AlertLink withoutMarginBottom>This one has no margin bottom.</AlertLink>
      </Fragment>
    );
  });

  story('size', () => {
    return (
      <Fragment>
        <p>
          The <JSXProperty name="size" value /> prop can be either <code>"small"</code> or{' '}
          <code>"normal"</code>.{' '}
        </p>
        <AlertLink priority="info" size="normal">
          Normal
        </AlertLink>
        <AlertLink priority="info" size="small">
          Small
        </AlertLink>
      </Fragment>
    );
  });

  story('to vs href vs onClick', () => {
    const [count, setCount] = useState(0);
    return (
      <Fragment>
        <p>
          There are three ways to specify what should happen when the{' '}
          <JSXNode name="AlertLink" /> is clicked.{' '}
        </p>
        <p>
          The <JSXProperty name="to" value /> prop should be used for internal links.
          Note: links specified with this prop will never open in a new tab, even if you
          set
          <JSXProperty name="openInNewTab" value="true" /> .
        </p>
        <AlertLink
          priority="info"
          size="normal"
          to="/stories/?name=app/components/badge.stories.tsx"
        >
          View the badge story page
        </AlertLink>
        <p>
          The <JSXProperty name="href" value /> prop should be used for external links.
        </p>
        <AlertLink
          priority="info"
          size="normal"
          href="https://sentry.io/for/session-replay/"
          openInNewTab
        >
          Learn more about Session Replay
        </AlertLink>
        <p>
          Lastly, you can get creative with the <JSXProperty name="onClick" value /> prop.
        </p>
        <AlertLink priority="info" size="normal" onClick={() => setCount(count + 1)}>
          You clicked this {count} times.
        </AlertLink>
      </Fragment>
    );
  });
});
