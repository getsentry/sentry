import {useContext, useState} from 'react';
import styled from '@emotion/styled';
import {motion} from 'framer-motion';

import {Button} from 'sentry/components/button';
import SelectControl from 'sentry/components/forms/controls/selectControl';
import Input from 'sentry/components/input';
import {t} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import {space} from 'sentry/styles/space';
import testableTransition from 'sentry/utils/testableTransition';
import StepHeading from 'sentry/views/relocation/components/stepHeading';
import {RelocationOnboardingContext} from 'sentry/views/relocation/relocationOnboardingContext';

import {StepProps} from './types';

function GetStarted(props: StepProps) {
  const regions = ConfigStore.get('regions');
  const [regionUrl, setRegionUrl] = useState('');
  const [orgSlugs, setOrgSlugs] = useState('');
  const relocationOnboardingContext = useContext(RelocationOnboardingContext);

  const handleContinue = (event: any) => {
    event.preventDefault();
    relocationOnboardingContext.setData({orgSlugs, regionUrl});
    props.onComplete();
  };
  return (
    <Wrapper>
      <StepHeading step={1}>{t('Basic information needed to get started')}</StepHeading>
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
          <RequiredLabel>{t('Organization slugs being relocated')}</RequiredLabel>
          <Input
            type="text"
            name="orgs"
            aria-label="org-slugs"
            onChange={evt => setOrgSlugs(evt.target.value)}
            required
            minLength={3}
            placeholder="org-slug-1, org-slug-2, ..."
          />
          <Label>{t('Choose a datacenter region')}</Label>
          <RegionSelect
            value={regionUrl}
            name="region"
            aria-label="region"
            placeholder="Select Region"
            options={regions.map(r => ({label: r.name, value: r.url}))}
            onChange={opt => setRegionUrl(opt.value)}
          />
          {regionUrl && (
            <p>{t('This is an important decision and cannot be changed.')}</p>
          )}
          <ContinueButton
            disabled={!orgSlugs || !regionUrl}
            priority="primary"
            type="submit"
          >
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
  background-color: ${p => p.theme.surface400};
  z-index: 100;
  box-shadow: 0 5px 10px rgba(0, 0, 0, 0.05);
  border-radius: 10px;
  max-width: 769px;
  max-height: 525px;
  color: ${p => p.theme.gray300};
  h2 {
    color: ${p => p.theme.gray500};
  }
`;

const ContinueButton = styled(Button)`
  margin-top: ${space(4)};
`;

const Form = styled('form')`
  position: relative;
`;

const Label = styled('label')`
  display: block;
  text-transform: uppercase;
  color: ${p => p.theme.gray500};
  margin-top: ${space(2)};
`;

const RequiredLabel = styled('label')`
  display: block;
  text-transform: uppercase;
  color: ${p => p.theme.gray500};
  margin-top: ${space(2)};
  &:after {
    content: '•';
    width: 6px;
    color: ${p => p.theme.red300};
  }
`;

const RegionSelect = styled(SelectControl)`
  padding-bottom: ${space(2)};
  button {
    width: 709px;
  }
`;
