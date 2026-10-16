import {Fragment, useState} from 'react';

import {CodeBlock} from '@sentry/scraps/code';
import {Text} from '@sentry/scraps/text';

import * as Storybook from 'sentry/stories';
import {LegacyBrowserFilter} from 'sentry/views/settings/project/projectFilters/legacyBrowserFilter';

function Demo({initial, disabled}: {initial: string[]; disabled?: boolean}) {
  const [subfilters, setSubfilters] = useState(initial);
  return (
    <LegacyBrowserFilter
      subfilters={subfilters}
      disabled={disabled}
      label={<Text bold>Filter out legacy browsers</Text>}
      hintText={
        <Text size="sm" variant="muted">
          The browser versions filtered out will be periodically evaluated and updated.
        </Text>
      }
      onToggle={setSubfilters}
    />
  );
}

export default Storybook.story('LegacyBrowserFilter', story => {
  story('Usage', () => (
    <Fragment>
      <Text as="p">
        One row per browser family with a Desktop and a Mobile switch. The component is
        controlled: it reports the full list of selected subfilter keys through{' '}
        <code>onToggle</code> and renders whatever <code>subfilters</code> it receives.
      </Text>
      <CodeBlock language="jsx">
        {`import {LegacyBrowserFilter} from 'sentry/views/settings/project/projectFilters/legacyBrowserFilter';

<LegacyBrowserFilter
  subfilters={['safari', 'safari_mobile']}
  label={<Text bold>Filter out legacy browsers</Text>}
  hintText={<Text size="sm">Cutoffs update over time.</Text>}
  onToggle={setSubfilters}
/>`}
      </CodeBlock>
    </Fragment>
  ));

  story('Default', () => <Demo initial={['ie', 'safari', 'safari_mobile']} />);

  story('With deprecated keys', () => (
    <Fragment>
      <Text as="p">
        Deprecated keys only render while they are still selected, so a project keeps
        seeing what it has enabled without new projects being offered the option.
      </Text>
      <Demo initial={['ie', 'ie9', 'safari_pre_6', 'android_pre_4']} />
    </Fragment>
  ));

  story('Disabled', () => <Demo initial={['chrome', 'chrome_mobile']} disabled />);
});
