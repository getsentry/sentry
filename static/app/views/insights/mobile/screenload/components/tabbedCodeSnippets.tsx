import {useState} from 'react';
import styled from '@emotion/styled';

import {CodeSnippet} from 'sentry/components/codeSnippet';
import {space} from 'sentry/styles/space';

export interface CodeSnippetTab {
  code: string;
  label: string;
  language: string;
  value: string;
  filename?: string;
}

interface TabbedCodeSnippetProps {
  /**
   * An array of tabs to be displayed
   */
  tabs: CodeSnippetTab[];
}

export function TabbedCodeSnippet({tabs}: TabbedCodeSnippetProps) {
  const [selectedTabValue, setSelectedTabValue] = useState(tabs[0]!.value);
  const selectedTab = tabs.find(tab => tab.value === selectedTabValue) ?? tabs[0]!;
  const {code, language, filename} = selectedTab;

  return (
    <StyledCodeSnippet
      tabs={tabs}
      language={language}
      hideCopyButton
      selectedTab={selectedTabValue}
      onTabClick={value => setSelectedTabValue(value)}
      filename={filename}
    >
      {code}
    </StyledCodeSnippet>
  );
}

const StyledCodeSnippet = styled(CodeSnippet)`
  pre {
    height: 213px;
  }
  margin-top: ${space(1)};
`;
