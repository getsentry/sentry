import {Fragment} from 'react';
import type {PropItem} from 'react-docgen-typescript';
import styled from '@emotion/styled';

import {Tooltip} from 'sentry/components/tooltip';
import {space} from 'sentry/styles/space';

interface StoryTypesProps {
  types: TypeLoader.ComponentDocWithFilename | undefined;
}

function sortRequiredOrByName(a: PropItem, b: PropItem): number {
  if (a.required && !b.required) {
    return -1;
  }
  if (!a.required && b.required) {
    return 1;
  }

  return a.name.localeCompare(b.name);
}

function groupByParent(props: PropItem[]) {
  return props.reduce(
    (acc, prop) => {
      acc[prop.parent?.fileName ?? ''] = (acc[prop.parent?.fileName ?? ''] ?? []).concat(
        prop
      );
      return acc;
    },
    {} as Record<string, PropItem[]>
  );
}

function stripNodeModulesPrefix(str: string): string {
  return str.split('/node_modules/')[1] ?? str;
}

export function StoryTypes(props: StoryTypesProps) {
  if (!props.types) {
    return (
      <p>
        This story has no types. You are either running storybook without types or the
        types you are attempting to pass to the story component are falsey.
      </p>
    );
  }

  const grouped = groupByParent(Object.values(props.types.props));

  return (
    <Fragment>
      <p>{props.types.description}</p>
      <StoryTableContainer>
        <StoryTypesTable>
          <StoryTypesTableHeader>
            <tr>
              <StoryTypesTableHeaderCell>Prop</StoryTypesTableHeaderCell>
              <StoryTypesTableHeaderCell>Description</StoryTypesTableHeaderCell>
            </tr>
          </StoryTypesTableHeader>
          <tbody>
            {Object.entries(grouped).map(([definitionFilePath, p], idx, arr) => {
              // @todo(jonasbadalic): Add a better parent fallback, see emotion theme for example
              const parent =
                p[0]?.parent?.name ??
                p[0]?.declarations?.[0]?.fileName ??
                'unknown package';

              return (
                <Fragment key={definitionFilePath}>
                  {/* The 0th element contains the types defined inside the component */}
                  {arr.length > 1 && idx > 0 ? (
                    <tr>
                      <StoryTypesTableCell colSpan={2}>
                        {parent} ({stripNodeModulesPrefix(definitionFilePath)})
                      </StoryTypesTableCell>
                    </tr>
                  ) : null}

                  {p.sort(sortRequiredOrByName).map(prop => (
                    <tr key={prop.name}>
                      <StoryTypesTableCell>
                        {prop.name}
                        {prop.required ? (
                          <Tooltip title="This is a required prop">
                            <Required />
                          </Tooltip>
                        ) : null}
                      </StoryTypesTableCell>
                      <StoryTypesTableCell>
                        {prop.description ? (
                          <StoryPropDescription>{prop.description}</StoryPropDescription>
                        ) : null}
                        <StoryType>
                          {prop.type.raw ? prop.type.raw : prop.type.name}
                        </StoryType>
                      </StoryTypesTableCell>
                    </tr>
                  ))}
                </Fragment>
              );
            })}
          </tbody>
        </StoryTypesTable>
      </StoryTableContainer>
    </Fragment>
  );
}

const StoryTableContainer = styled('div')`
  overflow: hidden;
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
`;

const StoryTypesTable = styled('table')`
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 0;
  border-radius: ${p => p.theme.borderRadius};
  word-break: normal;

  th {
    background-color: ${p => p.theme.surface200};
  }

  tr:not(:last-child) {
    border-bottom: 1px solid ${p => p.theme.border};
  }

  td:not(:last-child),
  th:not(:last-child) {
    border-right: 1px solid ${p => p.theme.border};
  }
`;

const StoryTypesTableHeader = styled('thead')`
  tr {
    background-color: ${p => p.theme.surface200};
    border-bottom: 1px solid ${p => p.theme.border};
  }
`;

const StoryTypesTableHeaderCell = styled('th')`
  background-color: ${p => p.theme.surface200};
  padding: ${space(1)};
`;

const StoryTypesTableCell = styled('td')`
  padding: ${space(1)};
`;

const StoryType = styled('div')`
  font-family: ${p => p.theme.text.familyMono};
`;

const StoryPropDescription = styled('div')`
  font-size: ${p => p.theme.fontSizeRelativeSmall};
  margin-bottom: ${space(0.5)};
`;

function Required() {
  return <RequiredAsterisk>*</RequiredAsterisk>;
}

const RequiredAsterisk = styled('span')`
  color: ${p => p.theme.error};
`;
