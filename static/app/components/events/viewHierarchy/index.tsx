import styled from '@emotion/styled';

function ViewHierarchy({hierarchy}) {
  return (
    <Container>
      <div>{hierarchy.title}</div>
      {!!hierarchy.children.length &&
        hierarchy.children.map(child => (
          <ViewHierarchy key={hierarchy.title} hierarchy={child} />
        ))}
    </Container>
  );
}

const Container = styled('div')`
  margin-left: 12px;
`;

export default ViewHierarchy;
