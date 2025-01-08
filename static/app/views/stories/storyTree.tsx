import {useState} from 'react';
import styled from '@emotion/styled';

import Link from 'sentry/components/links/link';
import {IconChevron, IconFile} from 'sentry/icons';
import {space} from 'sentry/styles/space';

import type {StoryTreeNode} from './index';

function folderFirst(a: [string, StoryTreeNode], b: [string, StoryTreeNode]) {
  const aIsFolder = Object.keys(a[1].children).length > 0;
  const bIsFolder = Object.keys(b[1].children).length > 0;

  if (aIsFolder && !bIsFolder) {
    return -1;
  }

  if (!aIsFolder && bIsFolder) {
    return 1;
  }

  return a[0].localeCompare(b[0]);
}
interface Props extends React.HTMLAttributes<HTMLDivElement> {
  nodes: StoryTreeNode[];
}

export default function StoryTree({nodes, ...htmlProps}: Props) {
  return (
    <nav {...htmlProps}>
      <StoryList>
        {nodes.map(node => {
          return Object.entries(node.children).length === 0 ? (
            <li key={node.name}>
              <File node={node} />
            </li>
          ) : (
            <Folder node={node} />
          );
        })}
      </StoryList>
    </nav>
  );
}

function Folder(props: {node: StoryTreeNode}) {
  const [expanded, setExpanded] = useState(props.node.expanded);

  return (
    <li>
      <FolderName onClick={() => setExpanded(!expanded)}>
        <IconChevron size="xs" direction={expanded ? 'down' : 'right'} />
        {capitalize(props.node.name)}
      </FolderName>
      {expanded && Object.entries(props.node.children).length > 0 && (
        <StoryList>
          {Object.entries(props.node.children)
            .sort(folderFirst)
            .map(([name, child]) => {
              return Object.keys(child.children).length === 0 ? (
                <li>
                  <File key={name} node={child} />
                </li>
              ) : (
                <Folder key={name} node={child} />
              );
            })}
        </StoryList>
      )}
    </li>
  );
}

function File(props: {node: StoryTreeNode}) {
  return (
    <FolderLink to={`/stories/?name=${props.node.path}`}>
      {/* @TODO (JonasBadalic): Do file type icons make sense here? */}
      <IconFile size="xs" />
      {/* @TODO (JonasBadalic): Do we need to show the file extension? */}
      {capitalize(props.node.name)}
    </FolderLink>
  );
}

function capitalize(str: string) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

const StoryList = styled('ul')`
  list-style-type: none;
  padding-left: 10px;

  &:first-child {
    padding-left: 0;
  }
`;

const FolderName = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(0.75)};
  padding: ${space(0.25)} 0;
  cursor: pointer;
`;

const FolderLink = styled(Link)`
  display: flex;
  align-items: center;
  margin-left: ${space(0.5)};
  gap: ${space(0.75)};
  color: ${p => p.theme.textColor};
  padding: ${space(0.25)} 0;

  &:hover {
    color: ${p => p.theme.textColor};
  }

  svg {
    flex-shrink: 0;
  }
`;

// function FolderContent({node}: {node: StoryTreeNode}) {
//   const location = useLocation<StoriesQuery>();
//   const currentFile = location.query.name;

//   return (
//     <StoryList>
//       {Object.entries(node.children).map(([name, children]) => {
//         // const childPath = toPath(path, name);

//         if (Object.keys(children).length === 0) {
//           // const isCurrent = childPath === currentFile ? true : undefined;
//           // const to = `/stories/?name=${childPath}`;
//           return (
//             <ListItem key={name} aria-current={isCurrent}>
//               <FolderLink to={to}>
//                 <IconFile size="xs" />
//                 {name}
//               </FolderLink>
//             </ListItem>
//           );
//         }

//         return (
//           <ListItem key={name}>
//             <Folder open>
//               <FolderName>{name}</FolderName>
//               <FolderContent node={node} />
//             </Folder>
//           </ListItem>
//         );
//       })}
//     </StoryList>
//   );
// }

// function toPath(path: string, name: string) {
//   return [path, name].filter(Boolean).join('/');
// }
