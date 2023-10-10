import {Fragment, useEffect, useMemo, useRef, useState} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import {CompactSelect} from 'sentry/components/compactSelect';
import {IconClose} from 'sentry/icons/iconClose';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Project, SelectValue} from 'sentry/types';
import useKeyPress from 'sentry/utils/useKeyPress';
import useOnClickOutside from 'sentry/utils/useOnClickOutside';
import SlideOverPanel from 'sentry/views/starfish/components/slideOverPanel';

import StyledIdBadge from '../../components/styledIdBadge';

type Props = {
  allEnvs: string[];
  selectedEnvs: string[];
  selectedProjects: Project[];
  formData?: {[key: string]: any};
  onClose?: () => void;
  onOpen?: () => void;
};

export default function ThresholdForm({
  allEnvs,
  formData: propFormData = undefined,
  selectedEnvs,
  selectedProjects,
  onClose,
  onOpen,
}: Props) {
  const [formOpen, setFormOpen] = useState<boolean>(false);
  const [formData, setFormData] = useState<{[key: string]: any}>({});
  const escapeKeyPressed = useKeyPress('Escape');

  // Any time the key prop changes (due to user interaction), we want to open the panel
  useEffect(() => {
    if (propFormData) {
      setFormOpen(true);
      setFormData({
        project:
          propFormData.project || selectedProjects.length === 1
            ? selectedProjects[0].id
            : '',
        environment:
          propFormData.environment || selectedEnvs.length === 1 ? selectedEnvs[0] : '',
      });
    } else {
      setFormOpen(false);
    }
  }, [propFormData, selectedEnvs, selectedProjects]);

  const panelRef = useRef<HTMLDivElement>(null);
  useOnClickOutside(panelRef, () => {
    if (formOpen) {
      resetForm();
    }
  });

  useEffect(() => {
    if (escapeKeyPressed) {
      if (formOpen) {
        resetForm();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [escapeKeyPressed]);

  const resetForm = () => {
    setFormData({});
    setFormOpen(false);
    onClose?.();
  };

  const updateForm = (key, value) => {
    const data = formData;
    data[key] = value;
    setFormData(data);
  };

  const projectSelectOptions: SelectValue<string>[] = useMemo(
    () =>
      selectedProjects.map(project => {
        return {
          value: project.id,
          textValue: project.slug,
          label: (
            <StyledIdBadge project={project} avatarSize={16} hideOverflow disableLink />
          ),
        };
      }),
    [selectedProjects]
  );

  const envSelectOptions: SelectValue<string>[] = useMemo(
    () =>
      allEnvs.map(env => {
        return {
          value: env,
          textValue: env,
          label: env,
        };
      }),
    [allEnvs]
  );

  return (
    <SlideOverPanel collapsed={!formOpen} ref={panelRef} onOpen={onOpen}>
      <FormSection>
        <Header>
          <div>Create New Threshold Group </div>
          <CloseButton
            priority="link"
            size="zero"
            borderless
            aria-label={t('Close Form')}
            icon={<IconClose size="sm" />}
            onClick={resetForm}
          />
        </Header>
      </FormSection>
      <div>Project: {formData && JSON.stringify(formData.project)}</div>
      <div>Environment: {formData && JSON.stringify(formData.environment)}</div>
      {formOpen && (
        <Fragment>
          <FormSection>
            <Title>Project & Environment Select</Title>
            <div>
              <CompactSelect
                position="bottom-end"
                onChange={selectedOption => updateForm('project', selectedOption.value)}
                value={formData.project}
                options={projectSelectOptions}
                disabled={selectedProjects.length === 1}
              />
              <CompactSelect
                position="bottom-end"
                onChange={selectedOption =>
                  updateForm('environment', selectedOption.value)
                }
                value={formData.environment}
                options={envSelectOptions}
              />
            </div>
          </FormSection>
          <FormSection>
            <Title>Time Window</Title>
          </FormSection>
          <FormSection>
            <Title>Set Threshold</Title>
          </FormSection>
        </Fragment>
      )}
    </SlideOverPanel>
  );
}

const CloseButton = styled(Button)`
  color: ${p => p.theme.gray300};
  &:hover {
    color: ${p => p.theme.gray400};
  }
`;

const FormSection = styled('div')`
  padding: ${space(2)};
  display: flex;
  flex-direction: column;
`;

const Header = styled('div')`
  justify-content: space-between;
  display: flex;
  color: ${p => p.theme.subText};
`;

const Title = styled('div')`
  color: ${p => p.theme.headingColor};
  font-size: ${p => p.theme.fontSizeLarge};
  font-weight: 600;
`;
