import {useState} from 'react';
import styled from '@emotion/styled';

import {
  IssueLabelInput,
  IssueLabelList,
  LabelFilter,
} from 'sentry/components/issueLabels';
import {Panel, PanelBody, PanelHeader} from 'sentry/components/panels';
import {useIssueLabels} from 'sentry/hooks/useIssueLabels';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

export function IssueLabelsDemo() {
  const {allLabels, getAllLabelNames, addLabel} = useIssueLabels();
  const [selectedLabels, setSelectedLabels] = useState<string[]>([]);

  const handleLabelChange = (labels: string[]) => {
    setSelectedLabels(labels);
  };

  const handleAddLabel = (labelName: string) => {
    // For demo purposes, add to a fake issue
    const fakeIssueId = 'demo-issue-1';
    return addLabel(fakeIssueId, labelName);
  };

  const allLabelNames = getAllLabelNames();

  return (
    <div>
      <h1>{t('Issue Labels Demo')}</h1>
      <p>{t('This is a demo of the issue labels functionality.')}</p>

      <DemoSection>
        <h2>{t('Label Filter')}</h2>
        <p>{t('Filter issues by labels:')}</p>
        <LabelFilter
          selectedLabels={selectedLabels}
          onLabelChange={handleLabelChange}
          size="md"
        />
        {selectedLabels.length > 0 && (
          <p>
            {t('Selected labels:')} {selectedLabels.join(', ')}
          </p>
        )}
      </DemoSection>

      <DemoSection>
        <h2>{t('All Labels')}</h2>
        <p>
          {t('Total unique labels:')} {allLabelNames.length}
        </p>
        {allLabelNames.length > 0 && (
          <div>
            <p>{t('Available labels:')}</p>
            <LabelList>
              {allLabelNames.map(labelName => (
                <span key={labelName} className="label-name">
                  {labelName}
                </span>
              ))}
            </LabelList>
          </div>
        )}
      </DemoSection>

      <DemoSection>
        <h2>{t('Label Management')}</h2>
        <p>{t('Add a new label to test:')}</p>
        <IssueLabelInput
          onAddLabel={handleAddLabel}
          size="md"
          placeholder={t('Enter label name...')}
        />
      </DemoSection>

      <DemoSection>
        <h2>{t('Sample Issue Labels')}</h2>
        <p>{t('Example of how labels would appear on an issue:')}</p>
        <Panel>
          <PanelHeader>{t('Sample Issue')}</PanelHeader>
          <PanelBody>
            <p>{t('This is a sample issue with some labels.')}</p>
            {allLabelNames.length > 0 && (
              <div>
                <p>{t('Labels:')}</p>
                <IssueLabelList
                  labels={allLabelNames.slice(0, 5).map((name, index) => ({
                    id: `demo-${index}`,
                    name,
                    color: `hsl(${index * 60}, 70%, 50%)`,
                  }))}
                  size="sm"
                  showRemoveButtons
                />
              </div>
            )}
          </PanelBody>
        </Panel>
      </DemoSection>
    </div>
  );
}

const DemoSection = styled('div')`
  margin-bottom: ${space(3)};

  h2 {
    margin-bottom: ${space(1)};
    color: ${p => p.theme.textColor};
  }

  p {
    margin-bottom: ${space(1)};
    color: ${p => p.theme.subText};
  }
`;

const LabelList = styled('div')`
  display: flex;
  flex-wrap: wrap;
  gap: ${space(0.5)};
  margin-top: ${space(1)};

  .label-name {
    background-color: ${p => p.theme.backgroundSecondary};
    border: 1px solid ${p => p.theme.border};
    border-radius: 12px;
    padding: ${space(0.5)} ${space(1)};
    font-size: 12px;
    color: ${p => p.theme.textColor};
  }
`;
