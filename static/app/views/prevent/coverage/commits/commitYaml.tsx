import styled from '@emotion/styled';

import {ExternalLink} from 'sentry/components/core/link';
import {IconGithub} from 'sentry/icons';

const LayoutGap = styled('div')`
  display: grid;
  gap: ${p => p.theme.space.xl};
  width: 100%;
  max-width: 1257px;
`;

const HeaderSection = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${p => p.theme.space.md};
  margin-top: ${p => p.theme.space.xl};
`;

const Title = styled('h2')`
  font-family: ${p => p.theme.text.family};
  font-weight: ${p => p.theme.fontWeight.bold};
  font-size: ${p => p.theme.fontSize.xl};
  line-height: ${p => p.theme.text.lineHeightHeading};
  letter-spacing: -0.64%;
  color: ${p => p.theme.headingColor};
  margin: 0;
`;

const Description = styled('p')`
  font-family: ${p => p.theme.text.family};
  font-weight: ${p => p.theme.fontWeight.normal};
  font-size: ${p => p.theme.fontSize.md};
  line-height: ${p => p.theme.text.lineHeightBody};
  color: ${p => p.theme.subText};
  margin: 0;
`;

const StyledLink = styled(ExternalLink)`
  color: ${p => p.theme.linkColor};
  text-decoration: none;

  &:hover {
    text-decoration: underline;
  }
`;

const CodeViewer = styled('div')`
  background: ${p => p.theme.background};
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
  overflow: hidden;
  width: 100%;
  max-width: 1257px;
`;

const FileHeader = styled('div')`
  background: ${p => p.theme.backgroundSecondary};
  border-bottom: 1px solid ${p => p.theme.innerBorder};
  padding: ${p => p.theme.space.md} ${p => p.theme.space.lg};
`;

const FileHeaderContent = styled('div')`
  display: flex;
  align-items: center;
  gap: ${p => p.theme.space.md};
`;

const FileName = styled('span')`
  font-family: ${p => p.theme.text.family};
  font-weight: ${p => p.theme.fontWeight.normal};
  font-size: ${p => p.theme.fontSize.sm};
  line-height: 1.18;
  color: ${p => p.theme.textColor};
`;

const CodeBlock = styled('div')`
  border-top: 1px solid ${p => p.theme.innerBorder};
`;

const CodeLine = styled('div')`
  display: flex;
  align-items: stretch;
  min-height: 26px;
`;

const LineNumber = styled('div')`
  display: flex;
  align-items: center;
  justify-content: right;
  width: 48px;
  padding: 0 ${p => p.theme.space.md};
  border-right: 1px solid ${p => p.theme.border};
  background: ${p => p.theme.background};
  font-family: ${p => p.theme.text.familyMono};
  font-weight: ${p => p.theme.fontWeight.normal};
  font-size: ${p => p.theme.codeFontSize};
  line-height: 2em;
  color: ${p => p.theme.textColor};
  flex-shrink: 0;
`;

const CodeContent = styled('div')`
  display: flex;
  align-items: center;
  padding: 0 ${p => p.theme.space.lg};
  font-family: ${p => p.theme.text.familyMono};
  font-weight: 425;
  font-size: ${p => p.theme.codeFontSize};
  line-height: 2em;
  color: ${p => p.theme.textColor};
  flex: 1;
  white-space: pre;
`;

const YamlKey = styled('span')`
  color: ${p => p.theme.textColor};
`;

const YamlValue = styled('span')`
  color: ${p => p.theme.purple400};
`;

const YamlNumber = styled('span')`
  color: var(--prism-selector);
`;

const YamlString = styled('span')`
  color: var(--prism-operator);
`;

function Indent({level}: {level: number}) {
  return <span>{' '.repeat(level * 2)}</span>;
}
function IndentList({level}: {level: number}) {
  return <span>{' '.repeat(level * 2)}- </span>;
}

export default function CommitYamlPage() {
  return (
    <LayoutGap>
      <HeaderSection>
        <Title>View repository YAML for this commit</Title>
        <Description>
          Review the settings for this commit. The repository-level YAML takes priority
          over your <StyledLink href="#">global YAML</StyledLink>, if both are configured.
          To learn more about Sentry YAML setup, please visit{' '}
          <StyledLink href="#">our doc</StyledLink>.
        </Description>
      </HeaderSection>

      <CodeViewer>
        <FileHeader>
          <FileHeaderContent>
            <IconGithub size="xs" color="gray300" />
            <FileName>./gazebo/.github/workflow/sentry-prevent.yml</FileName>
          </FileHeaderContent>
        </FileHeader>

        <CodeBlock>
          <CodeLine>
            <LineNumber>1</LineNumber>
            <CodeContent>
              <YamlKey>ai_pr_review</YamlKey>:
            </CodeContent>
          </CodeLine>
          <CodeLine>
            <LineNumber>2</LineNumber>
            <CodeContent>
              <Indent level={1} />
              <YamlKey>enabled</YamlKey>: <YamlValue>false</YamlValue>
            </CodeContent>
          </CodeLine>
          <CodeLine>
            <LineNumber>3</LineNumber>
            <CodeContent>
              <YamlKey>sentry-prevent</YamlKey>:
            </CodeContent>
          </CodeLine>
          <CodeLine>
            <LineNumber>4</LineNumber>
            <CodeContent>
              <Indent level={1} />
              <YamlKey>notify</YamlKey>:
            </CodeContent>
          </CodeLine>
          <CodeLine>
            <LineNumber>5</LineNumber>
            <CodeContent>
              <Indent level={2} />
              <YamlKey>wait_for_ci</YamlKey>: <YamlValue>true</YamlValue>
            </CodeContent>
          </CodeLine>
          <CodeLine>
            <LineNumber>6</LineNumber>
            <CodeContent>
              <Indent level={2} />
              <YamlKey>require_ci_to_pass</YamlKey>: <YamlValue>true</YamlValue>
            </CodeContent>
          </CodeLine>
          <CodeLine>
            <LineNumber>7</LineNumber>
            <CodeContent>
              <YamlKey>comment</YamlKey>:
            </CodeContent>
          </CodeLine>
          <CodeLine>
            <LineNumber>8</LineNumber>
            <CodeContent>
              <Indent level={1} />
              <YamlKey>after_n_builds</YamlKey>: <YamlNumber>9</YamlNumber>
            </CodeContent>
          </CodeLine>
          <CodeLine>
            <LineNumber>9</LineNumber>
            <CodeContent>
              <Indent level={1} />
              <YamlKey>behavior</YamlKey>: <YamlValue>default</YamlValue>
            </CodeContent>
          </CodeLine>
          <CodeLine>
            <LineNumber>10</LineNumber>
            <CodeContent>
              <Indent level={1} />
              <YamlKey>layout</YamlKey>:{' '}
              <YamlValue>diff, flags, files, components, footer</YamlValue>
            </CodeContent>
          </CodeLine>
          <CodeLine>
            <LineNumber>11</LineNumber>
            <CodeContent>
              <Indent level={1} />
              <YamlKey>require_base</YamlKey>: <YamlValue>false</YamlValue>
            </CodeContent>
          </CodeLine>
          <CodeLine>
            <LineNumber>12</LineNumber>
            <CodeContent>
              <Indent level={1} />
              <YamlKey>require_changes</YamlKey>:
            </CodeContent>
          </CodeLine>
          <CodeLine>
            <LineNumber>13</LineNumber>
            <CodeContent>
              <IndentList level={1} />
              <YamlNumber>0</YamlNumber>
            </CodeContent>
          </CodeLine>
          <CodeLine>
            <LineNumber>14</LineNumber>
            <CodeContent>
              <Indent level={1} />
              <YamlKey>require_head</YamlKey>: <YamlValue>true</YamlValue>
            </CodeContent>
          </CodeLine>
          <CodeLine>
            <LineNumber>15</LineNumber>
            <CodeContent>
              <Indent level={1} />
              <YamlKey>show_carryforward_flags</YamlKey>: <YamlValue>false</YamlValue>
            </CodeContent>
          </CodeLine>
          <CodeLine>
            <LineNumber>16</LineNumber>
            <CodeContent>
              <YamlKey>component_management</YamlKey>:
            </CodeContent>
          </CodeLine>
          <CodeLine>
            <LineNumber>17</LineNumber>
            <CodeContent>
              <Indent level={1} />
              <YamlKey>default_rules</YamlKey>:
            </CodeContent>
          </CodeLine>
          <CodeLine>
            <LineNumber>18</LineNumber>
            <CodeContent>
              <Indent level={2} />
              <YamlKey>statuses</YamlKey>:
            </CodeContent>
          </CodeLine>
          <CodeLine>
            <LineNumber>19</LineNumber>
            <CodeContent>
              {'    - '}
              <YamlKey>branches</YamlKey>:
            </CodeContent>
          </CodeLine>
          <CodeLine>
            <LineNumber>20</LineNumber>
            <CodeContent>
              {'      - '}
              <YamlString>^!main$</YamlString>
            </CodeContent>
          </CodeLine>
          <CodeLine>
            <LineNumber>21</LineNumber>
            <CodeContent>
              {'      '}
              <YamlKey>target</YamlKey>: <YamlValue>auto</YamlValue>
            </CodeContent>
          </CodeLine>
          <CodeLine>
            <LineNumber>22</LineNumber>
            <CodeContent>
              {'      '}
              <YamlKey>type</YamlKey>: <YamlValue>patch</YamlValue>
            </CodeContent>
          </CodeLine>
          <CodeLine>
            <LineNumber>23</LineNumber>
            <CodeContent>
              <YamlKey>coverage</YamlKey>:
            </CodeContent>
          </CodeLine>
          <CodeLine>
            <LineNumber>24</LineNumber>
            <CodeContent>
              <Indent level={1} />
              <YamlKey>precision</YamlKey>: <YamlNumber>2</YamlNumber>
            </CodeContent>
          </CodeLine>
          <CodeLine>
            <LineNumber>25</LineNumber>
            <CodeContent>
              <Indent level={1} />
              <YamlKey>range</YamlKey>:
            </CodeContent>
          </CodeLine>
          <CodeLine>
            <LineNumber>26</LineNumber>
            <CodeContent>
              <Indent level={2} />
              <YamlNumber>- 60.0</YamlNumber>
            </CodeContent>
          </CodeLine>
          <CodeLine>
            <LineNumber>27</LineNumber>
            <CodeContent>
              <Indent level={2} />
              <YamlNumber>- 85.0</YamlNumber>
            </CodeContent>
          </CodeLine>
          <CodeLine>
            <LineNumber>28</LineNumber>
            <CodeContent>
              <Indent level={1} />
              <YamlKey>round</YamlKey>: <YamlValue>down</YamlValue>
            </CodeContent>
          </CodeLine>
          <CodeLine>
            <LineNumber>29</LineNumber>
            <CodeContent>
              <Indent level={1} />
              <YamlKey>status</YamlKey>:
            </CodeContent>
          </CodeLine>
          <CodeLine>
            <LineNumber>30</LineNumber>
            <CodeContent>
              <Indent level={2} />
              <YamlKey>changes</YamlKey>: <YamlValue>false</YamlValue>
            </CodeContent>
          </CodeLine>
          <CodeLine>
            <LineNumber>31</LineNumber>
            <CodeContent>
              <Indent level={2} />
              <YamlKey>default_rules</YamlKey>:
            </CodeContent>
          </CodeLine>
          <CodeLine>
            <LineNumber>32</LineNumber>
            <CodeContent>
              <Indent level={3} />
              <YamlKey>flag_coverage_not_uploaded_behavior</YamlKey>:{' '}
              <YamlValue>include</YamlValue>
            </CodeContent>
          </CodeLine>
          <CodeLine>
            <LineNumber>33</LineNumber>
            <CodeContent>
              <Indent level={2} />
              <YamlKey>patch</YamlKey>: <YamlValue>true</YamlValue>
            </CodeContent>
          </CodeLine>
          <CodeLine>
            <LineNumber>34</LineNumber>
            <CodeContent>
              <Indent level={2} />
              <YamlKey>project</YamlKey>: <YamlValue>true</YamlValue>
            </CodeContent>
          </CodeLine>
          <CodeLine>
            <LineNumber>35</LineNumber>
            <CodeContent>
              <YamlKey>github_checks</YamlKey>:
            </CodeContent>
          </CodeLine>
          <CodeLine>
            <LineNumber>36</LineNumber>
            <CodeContent>
              <Indent level={1} />
              <YamlKey>annotations</YamlKey>: <YamlValue>false</YamlValue>
            </CodeContent>
          </CodeLine>
          <CodeLine>
            <LineNumber>37</LineNumber>
            <CodeContent>
              <YamlKey>slack_app</YamlKey>: <YamlValue>true</YamlValue>
            </CodeContent>
          </CodeLine>
          <CodeLine>
            <LineNumber>38</LineNumber>
            <CodeContent>
              <YamlKey>test_analytics</YamlKey>:
            </CodeContent>
          </CodeLine>
          <CodeLine>
            <LineNumber>39</LineNumber>
            <CodeContent>
              <Indent level={1} />
              <YamlKey>flake_detection</YamlKey>: <YamlValue>true</YamlValue>
            </CodeContent>
          </CodeLine>
        </CodeBlock>
      </CodeViewer>
    </LayoutGap>
  );
}

// YAML lines mapping:
// 2 spaces = <Indent level={1} />
// 4 spaces = <Indent level={2} />
// 6 spaces = <Indent level={3} />
