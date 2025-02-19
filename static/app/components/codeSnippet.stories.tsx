import {Fragment, useState} from 'react';

import {addSuccessMessage} from 'sentry/actionCreators/indicator';
import {CodeSnippet} from 'sentry/components/codeSnippet';
import JSXNode from 'sentry/components/stories/jsxNode';
import JSXProperty from 'sentry/components/stories/jsxProperty';
import {IconStar} from 'sentry/icons';
import storyBook from 'sentry/stories/storyBook';

export default storyBook('CodeSnippet', story => {
  story('Defaults', () => (
    <Fragment>
      <p>
        The <JSXNode name="CodeSnippet" /> component is useful when you want to render
        code instructions in onboarding or other setup situations. By default, the code
        snippet is able to be copied, selected, and has rounded corners and shows in light
        mode. It'll also apply formatting automatically, if the language (passed in with
        the <JSXProperty name="language" value={String} />
        prop) is known.
      </p>

      <p>JavaScript example:</p>
      <CodeSnippet language="javascript">{`Sentry.init({
  // Note, Replay is NOT instantiated below:
  integrations: [],
});

// Sometime later
const { replayIntegration } = await import("@sentry/browser");
Sentry.addIntegration(replayIntegration());`}</CodeSnippet>

      <p>Python example:</p>
      <CodeSnippet language="python">{`sentry_sdk.metrics.incr(
	key="button_click",
	value=1,
	tags={
		"browser": "Firefox",
		"app_version": "1.0.0"
	}
)`}</CodeSnippet>
    </Fragment>
  ));

  story('Props', () => {
    const [tab, setTab] = useState('npm');

    return (
      <Fragment>
        <p>
          You can customize the display of the <JSXNode name="CodeSnippet" />:
        </p>

        <h2>
          <JSXProperty name="dark" value />
        </h2>
        <CodeSnippet dark language="javascript">{`Sentry.init({
  // Note, Replay is NOT instantiated below:
  integrations: [],
});

// Sometime later
const { replayIntegration } = await import("@sentry/browser");
Sentry.addIntegration(replayIntegration());`}</CodeSnippet>
        <br />
        <h2>with tabs</h2>
        <CodeSnippet
          tabs={[
            {label: 'npm', value: 'npm'},
            {label: 'Yarn', value: 'yarn'},
          ]}
          selectedTab={tab}
          onTabClick={t => setTab(t)}
          language="javascript"
        >
          {tab === 'npm'
            ? `npm install --save @sentry/browser`
            : 'yarn add @sentry/browser'}
        </CodeSnippet>
        <br />
        <h2>
          <JSXProperty name="isRounded" value={false} />
        </h2>
        <CodeSnippet isRounded={false} dark language="javascript">{`Sentry.init({
  // Note, Replay is NOT instantiated below:
  integrations: [],
});

// Sometime later
const { replayIntegration } = await import("@sentry/browser");
Sentry.addIntegration(replayIntegration());`}</CodeSnippet>
        <br />
        <h2>
          <JSXProperty name="hideCopyButton" value />
        </h2>
        <CodeSnippet hideCopyButton language="javascript">{`Sentry.init({
  // Note, Replay is NOT instantiated below:
  integrations: [],
});

// Sometime later
const { replayIntegration } = await import("@sentry/browser");
Sentry.addIntegration(replayIntegration());`}</CodeSnippet>
        <br />
        <h2>
          <JSXProperty name="disableUserSelection" value />
        </h2>
        <CodeSnippet disableUserSelection language="javascript">{`Sentry.init({
  // Note, Replay is NOT instantiated below:
  integrations: [],
});

// Sometime later
const { replayIntegration } = await import("@sentry/browser");
Sentry.addIntegration(replayIntegration());`}</CodeSnippet>
        <br />
        <h2>
          <JSXProperty name="filename" value="index.jsx" />
        </h2>
        <CodeSnippet filename={'index.jsx'} language="javascript">{`Sentry.init({
  // Note, Replay is NOT instantiated below:
  integrations: [],
});

// Sometime later
const { replayIntegration } = await import("@sentry/browser");
Sentry.addIntegration(replayIntegration());`}</CodeSnippet>
        <br />
        <h2>
          <JSXProperty name="icon" value />
        </h2>
        <CodeSnippet icon={<IconStar />} language="javascript">{`Sentry.init({
  // Note, Replay is NOT instantiated below:
  integrations: [],
});

// Sometime later
const { replayIntegration } = await import("@sentry/browser");
Sentry.addIntegration(replayIntegration());`}</CodeSnippet>
        <br />
        <h2>
          <JSXProperty name="linesToHighlight" value={[1, 3, 4]} />
        </h2>
        <CodeSnippet
          linesToHighlight={[1, 3, 4]}
          disableUserSelection
          language="javascript"
        >{`Sentry.init({
  // Note, Replay is NOT instantiated below:
  integrations: [],
});

// Sometime later
const { replayIntegration } = await import("@sentry/browser");
Sentry.addIntegration(replayIntegration());`}</CodeSnippet>
      </Fragment>
    );
  });

  story('Callbacks', () => {
    const [tab, setTab] = useState('npm');
    const onCopy = () => addSuccessMessage('Copied!');
    const onSelectAndCopy = () =>
      addSuccessMessage(
        'Copied...but you know you can just press the copy button to copy it all, right?'
      );
    const onTabClick = () => addSuccessMessage('Clicked a different tab');

    return (
      <Fragment>
        <p>
          You can customize what happens when the user clicks the copy button, after the
          user highlights a part of the code snippet, after the user selects and manually
          copies the code snippet, or when a tab is clicked by specifying the callback.
        </p>
        <h2>
          <JSXProperty name="onCopy" value />
        </h2>
        <p>Try pressing the copy button:</p>
        <CodeSnippet onCopy={onCopy} language="javascript">{`Sentry.init({
  // Note, Replay is NOT instantiated below:
  integrations: [],
});

// Sometime later
const { replayIntegration } = await import("@sentry/browser");
Sentry.addIntegration(replayIntegration());`}</CodeSnippet>
        <br />
        <h2>
          <JSXProperty name="onSelectAndCopy" value />
        </h2>
        <p>Try manually selecting and copying code:</p>
        <CodeSnippet
          onSelectAndCopy={onSelectAndCopy}
          language="javascript"
        >{`Sentry.init({
  // Note, Replay is NOT instantiated below:
  integrations: [],
});

// Sometime later
const { replayIntegration } = await import("@sentry/browser");
Sentry.addIntegration(replayIntegration());`}</CodeSnippet>
        <br />
        <h2>
          <JSXProperty name="onTabClick" value />
        </h2>
        <p>Try switching tabs:</p>
        <CodeSnippet
          tabs={[
            {label: 'npm', value: 'npm'},
            {label: 'Yarn', value: 'yarn'},
          ]}
          selectedTab={tab}
          onTabClick={t => {
            setTab(t);
            onTabClick();
          }}
          language="javascript"
        >
          {tab === 'npm'
            ? `npm install --save @sentry/browser`
            : 'yarn add @sentry/browser'}
        </CodeSnippet>{' '}
      </Fragment>
    );
  });
});
