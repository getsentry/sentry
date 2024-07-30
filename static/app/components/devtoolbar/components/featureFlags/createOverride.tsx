import {useState} from 'react';

import {Button} from 'sentry/components/button';
import Input from 'sentry/components/input';
import Switch from 'sentry/components/switchButton';
import {IconAdd} from 'sentry/icons';

import useConfiguration from '../../hooks/useConfiguration';

import {useFeatureFlagsContext} from './featureFlagsContext';

export default function CreateOverride() {
  const {featureFlags, trackAnalytics} = useConfiguration();

  const {hasOverride} = useFeatureFlagsContext();

  const [name, setName] = useState('');
  const [isActive, setIsActive] = useState(false);
  return (
    <form
      css={[
        {
          display: 'grid',
          gridTemplateColumns: 'auto max-content auto',
          alignItems: 'center',
          justifyItems: 'space-between',
          gap: 'var(--space100)',
        },
      ]}
      onSubmit={e => {
        e.preventDefault();
        featureFlags?.setOverrideValue?.(name, isActive);
        hasOverride();
        setName('');
        setIsActive(false);
      }}
    >
      <Input
        size="xs"
        placeholder="Flag name to override"
        value={name}
        onChange={e => setName(e.target.value.toLowerCase())}
      />
      <Switch
        isActive={isActive}
        toggle={() => {
          setIsActive(!isActive);
          trackAnalytics?.({
            eventKey: 'devtoolbar.feature-flag-list-item-override',
            eventName: 'devtoolbar: Override a feature-flag value',
          });
        }}
      />
      <Button size="xs" type="submit" icon={<IconAdd />}>
        Save
      </Button>
    </form>
  );
}
