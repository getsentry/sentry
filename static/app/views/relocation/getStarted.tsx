import {useContext, useState} from 'react';
import styled from '@emotion/styled';
import {motion} from 'framer-motion';

import {Button} from 'sentry/components/button';
import SelectControl from 'sentry/components/forms/controls/selectControl';
import Input from 'sentry/components/input';
import {RelocationOnboardingContext} from 'sentry/components/onboarding/relocationOnboardingContext';
import {t} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import {space} from 'sentry/styles/space';
import testableTransition from 'sentry/utils/testableTransition';
import StepHeading from 'sentry/views/relocation/components/stepHeading';

import {StepProps} from './types';

function GetStarted(props: StepProps) {
  const regions = ConfigStore.get('regions');
  const [region, setRegion] = useState(regions[0].name);
  const [orgSlugs, setOrgSlugs] = useState('');
  const relocationOnboardingContext = useContext(RelocationOnboardingContext);

  const handleContinue = (event: any) => {
    event.preventDefault();
    const formData = new FormData(event.target);
    relocationOnboardingContext.setData({formData});
    props.onComplete();
  };
  return (
    <Wrapper>
      <StepHeading step={1}>{t('Basic Information Needed to Get Started')}</StepHeading>
      <motion.div
        transition={testableTransition()}
        variants={{
          initial: {y: 30, opacity: 0},
          animate: {y: 0, opacity: 1},
          exit: {opacity: 0},
        }}
      >
        <Form onSubmit={handleContinue}>
          <p>
            {t(
              'In order to best facilitate the process some basic information will be required to ensure sucess with the relocation process of you self-hosted instance'
            )}
          </p>
          <RequiredLabel>{t('Organization Slugs')}</RequiredLabel>
          <Input
            type="text"
            name="org-slugs"
            aria-label="org-slugs"
            onChange={evt => setOrgSlugs(evt.target.value)}
            required
            minLength={1}
            placeholder=""
          />
          <Label>{t('Choose a Datacenter Region')}</Label>
          <RegionSelect
            value={region}
            name="region"
            aria-label="region"
            options={regions.map(r => ({label: r.name, value: r.name}))}
            onChange={opt => setRegion(opt.value)}
          />
          <ContinueButton disabled={!orgSlugs} size="md" priority="primary" type="submit">
            {t('Continue')}
          </ContinueButton>
        </Form>
      </motion.div>
    </Wrapper>
  );
}

export default GetStarted;

const AnimatedContentWrapper = styled(motion.div)`
  overflow: hidden;
`;

AnimatedContentWrapper.defaultProps = {
  initial: {
    height: 0,
  },
  animate: {
    height: 'auto',
  },
  exit: {
    height: 0,
  },
};

const DocsWrapper = styled(motion.div)``;

DocsWrapper.defaultProps = {
  initial: {opacity: 0, y: 40},
  animate: {opacity: 1, y: 0},
  exit: {opacity: 0},
};

const Wrapper = styled('div')`
  margin-left: auto;
  margin-right: auto;
  padding: ${space(4)};
  background-color: #ffffff;
  z-index: 100;
  box-shadow: 0 5px 10px rgba(0, 0, 0, 0.05);
  border-radius: 10px;
  max-width: 769px;
  max-height: 525px;
  color: #80708f;
  h2 {
    color: #4d4158;
  }
`;

const ContinueButton = styled(Button)`
  margin-top: ${space(1.5)};
`;

const Form = styled('form')`
  position: relative;
`;

const Label = styled('label')`
  display: block;
  text-transform: uppercase;
  color: #4d4158;
  margin-top: ${space(2)};
`;

const RequiredLabel = styled('label')`
  display: block;
  text-transform: uppercase;
  color: #4d4158;
  margin-top: ${space(2)};
  &:after {
    content: '•';
    width: 6px;
    color: #f55459;
  }
`;

const RegionSelect = styled(SelectControl)`
  button {
    width: 709px;
  }
`;
