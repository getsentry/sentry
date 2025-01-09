import {useContext, useState} from 'react';
import {css} from '@emotion/react';

import {resetButtonCss} from 'sentry/components/devtoolbar/styles/reset';
import Input from 'sentry/components/input';
import Switch from 'sentry/components/switchButton';
import {IconAdd} from 'sentry/icons';

import useConfiguration from '../../hooks/useConfiguration';
import {AnalyticsContext} from '../analyticsProvider';

import {useFeatureFlagsContext} from './featureFlagsContext';

export default function CustomOverride({
  setComponentActive,
}: {
  setComponentActive: (value: boolean) => void;
}) {
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
          gridTemplateColumns: 'auto max-content max-content',
          alignItems: 'center',
          justifyItems: 'space-between',
          gap: 'var(--space100)',
        },
      ]}
      onSubmit={e => {
        e.preventDefault();
        setOverride(name, isActive);
        setComponentActive(false);
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
        size="lg"
        isActive={isActive}
        toggle={() => {
          setIsActive(!isActive);
        }}
        css={{background: 'white'}}
      />
      <button
        type="submit"
        css={[
          resetButtonCss,
          css`
            width: 28px;
          `,
        ]}
        disabled={!name.length}
      >
        <IconAdd />
      </button>
    </form>
  );
}
