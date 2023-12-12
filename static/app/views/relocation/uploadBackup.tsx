import {useContext, useRef, useState} from 'react';
import styled from '@emotion/styled';
import {motion} from 'framer-motion';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {Client} from 'sentry/api';
import {Button} from 'sentry/components/button';
import {RelocationOnboardingContext} from 'sentry/components/onboarding/relocationOnboardingContext';
import Well from 'sentry/components/well';
import {IconFile, IconUpload} from 'sentry/icons';
import {t} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import {space} from 'sentry/styles/space';
import testableTransition from 'sentry/utils/testableTransition';
import useApi from 'sentry/utils/useApi';
import StepHeading from 'sentry/views/relocation/components/stepHeading';

import {StepProps} from './types';

type UploadWellProps = {
  centered: boolean;
  draggedOver: boolean;
  onDragEnter: Function;
  onDragLeave: Function;
  onDragOver: Function;
  onDrop: Function;
};

export function UploadBackup(__props: StepProps) {
  const api = useApi({
    api: new Client({headers: {Accept: 'application/json; charset=utf-8'}}),
  });
  const [file, setFile] = useState<File>();
  const [dragCounter, setDragCounter] = useState(0);
  const inputFileRef = useRef<HTMLInputElement>(null);
  const relocationOnboardingContext = useContext(RelocationOnboardingContext);
  const user = ConfigStore.get('user');

  const handleDragEnter = event => {
    event.preventDefault();
    setDragCounter(dragCounter + 1);
  };

  const handleDragLeave = () => {
    setDragCounter(dragCounter - 1);
  };

  const handleDrop = event => {
    event.preventDefault();
    setDragCounter(0);

    setFile(event.dataTransfer.files[0]);
  };

  const handleFileChange = event => {
    const newFile = event.target.files?.[0];

    // No file selected (e.g. user clicked "cancel")
    if (!newFile) {
      return;
    }

    setFile(newFile);
  };

  const onFileUploadLinkClick = () => {
    inputFileRef.current && inputFileRef.current.click();
  };

  const handleStartRelocation = async () => {
    const {orgSlugs, regionUrl} = relocationOnboardingContext.data;
    if (!orgSlugs || !regionUrl || !file) {
      addErrorMessage(
        t(
          'An error has occured while trying to start relocation job. Please contact support for further assistance.'
        )
      );
      return;
    }
    const formData = new FormData();
    formData.set('orgs', orgSlugs);
    formData.set('file', file);
    formData.set('owner', user.email);
    try {
      await api.requestPromise(`/relocations/`, {
        method: 'POST',
        host: regionUrl,
        data: formData,
      });

      addSuccessMessage('Triggered Relocation Job');
    } catch (error) {
      addErrorMessage(error.responseJSON?.detail);
    }
  };

  return (
    <Wrapper>
      <StepHeading step={4}>
        {t('Upload Tarball to begin the relocation process')}
      </StepHeading>
      <motion.div
        transition={testableTransition()}
        variants={{
          initial: {y: 30, opacity: 0},
          animate: {y: 0, opacity: 1},
          exit: {opacity: 0},
        }}
      >
        <p>
          {t(
            'Nearly done! The file is being uploaded to sentry for the relocation process. You can close this tab if you like. We will email  when complete.'
          )}
        </p>
        {file ? (
          <FinishedWell centered>
            <IconFile className="file-icon" size="xl" />
            <div>
              <p>{file.name}</p>
              <a onClick={() => setFile(undefined)}>{t('Remove file')}</a>
            </div>
            <StartRelocationButton
              size="md"
              priority="primary"
              onClick={handleStartRelocation}
              icon={<IconUpload className="upload-icon" size="xs" />}
            >
              {t('Start Relocation')}
            </StartRelocationButton>
          </FinishedWell>
        ) : (
          <UploadWell
            onDragEnter={handleDragEnter}
            onDragOver={event => event.preventDefault()}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            centered
            aria-label="dropzone"
            draggedOver={dragCounter > 0}
          >
            <StyledUploadIcon className="upload-icon" size="xl" />
            <UploadWrapper>
              <p>{t('Drag and Drop file here or')}</p>
              <a onClick={onFileUploadLinkClick}>{t('Choose file')}</a>
              <UploadInput
                name="file"
                type="file"
                aria-label="file-upload"
                accept=".tar"
                ref={inputFileRef}
                onChange={e => handleFileChange(e)}
                hidden
                title=""
              />
            </UploadWrapper>
          </UploadWell>
        )}
      </motion.div>
    </Wrapper>
  );
}

export default UploadBackup;

const StyledUploadIcon = styled(IconUpload)`
  margin-top: ${space(2)};
  margin-bottom: ${space(1)};
`;

const Wrapper = styled('div')`
  max-width: 769px;
  max-height: 525px;
  margin-left: auto;
  margin-right: auto;
  padding: ${space(4)};
  background-color: ${p => p.theme.surface400};
  z-index: 100;
  box-shadow: 0 5px 10px rgba(0, 0, 0, 0.05);
  border-radius: 10px;
  width: 100%;
  font-size: 16px;
  color: ${p => p.theme.gray300};
  mark {
    border-radius: 8px;
    padding: ${space(0.25)} ${space(0.5)} ${space(0.25)} ${space(0.5)};
    background: ${p => p.theme.gray100};
    margin-right: ${space(1)};
  }
  h2 {
    color: ${p => p.theme.gray500};
  }
  p {
    margin-bottom: ${space(1)};
  }
  .encrypt-help {
    color: ${p => p.theme.gray500};
  }
`;

const StartRelocationButton = styled(Button)`
  margin-left: auto;
`;

const FinishedWell = styled(Well)`
  display: flex;
  align-items: center;
  text-align: left;
  div {
    margin-left: ${space(2)};
    line-height: 1;
  }
  a {
    color: ${p => p.theme.translucentGray200};
    font-size: 14px;
  }
  a:hover {
    color: ${p => p.theme.gray300};
  }
`;

const UploadWell = styled(Well)<UploadWellProps>`
  margin-top: ${space(2)};
  height: 140px;
  border-style: ${props => (props.draggedOver ? 'solid' : 'dashed')};
  border-width: medium;
  align-items: center;
  .file-icon,
  .upload-icon {
    color: ${p => p.theme.gray500};
  }
  background: ${props =>
    props.draggedOver ? p => p.theme.purple100 : p => p.theme.surface400};
`;

const UploadInput = styled('input')`
  opacity: 0;
`;

const UploadWrapper = styled('div')`
  display: flex;
  justify-content: center;
  a {
    padding-left: ${space(0.5)};
  }
  input[type='file'] {
    display: none;
  }
`;
