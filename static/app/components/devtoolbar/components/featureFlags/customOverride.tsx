import {useContext, useState} from 'react';

import {Button} from 'sentry/components/button';
import Input from 'sentry/components/input';
import Switch from 'sentry/components/switchButton';

import useConfiguration from '../../hooks/useConfiguration';
import {AnalyticsContext} from '../analyticsProvider';

import {useFeatureFlagsContext} from './featureFlagsContext';

export default function CustomOverride() {
  const {eventName, eventKey} = useContext(AnalyticsContext);
  const {trackAnalytics} = useConfiguration();
  const {setOverride} = useFeatureFlagsContext();

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
        setOverride(name, isActive);
        setName('');
        setIsActive(false);
        trackAnalytics?.({
          eventKey: eventKey + '.created',
          eventName: eventName + ' created',
        });
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
        }}
      />
      <Button size="xs" type="submit">
        Add Override
      </Button>
    </form>
  );
}
