import {createContext, useCallback, useContext, useState} from 'react';

type StoryIndexReference = {
  id: string;
  label: string;
  ref: HTMLElement | null;
};

const StoryIndexContext = createContext<StoryIndexReference[]>([]);
const StoryIndexRegisterContext = createContext<
  (obj: {id: string; label: string}) => (ref: HTMLElement | null) => void
>(() => () => {});

export function StoryIndexProvider({children}: {children: React.ReactNode}) {
  const [storyIndex, setStoryIndex] = useState<StoryIndexReference[]>([]);

  const register = useCallback(
    (obj: {id: string; label: string}) => {
      // Closes over the ref so that we can maintain the reference to the element in the array
      const ref: StoryIndexReference = {id: obj.id, label: obj.label, ref: null};

      return (element: HTMLElement | null) => {
        if (element === null) {
          setStoryIndex(prev => prev.filter(s => s !== ref));
        } else {
          ref.ref = element;
          setStoryIndex(prev => prev.concat(ref));
        }
      };
    },
    [setStoryIndex]
  );

  return (
    <StoryIndexContext.Provider value={storyIndex}>
      <StoryIndexRegisterContext.Provider value={register}>
        {children}
      </StoryIndexRegisterContext.Provider>
    </StoryIndexContext.Provider>
  );
}

export function useStoryIndexRegister({id, label}: {id: string; label: string}) {
  const callback = useContext(StoryIndexRegisterContext);
  if (!callback) {
    throw new Error('useStoryIndexRegister must be used within a StoryIndexProvider');
  }
  return callback({id, label});
}

const sortByDOMOrder = (a: StoryIndexReference, b: StoryIndexReference) => {
  if (a.ref && b.ref) {
    const position = a.ref.compareDocumentPosition(b.ref);
    if (
      position & Node.DOCUMENT_POSITION_FOLLOWING ||
      position & Node.DOCUMENT_POSITION_CONTAINED_BY
    ) {
      return -1;
    }
    if (
      position & Node.DOCUMENT_POSITION_PRECEDING ||
      position & Node.DOCUMENT_POSITION_CONTAINS
    ) {
      return 1;
    }
    return 0;
  }

  if (a.ref) {
    return 1;
  }

  return -1;
};

export function StoryIndex() {
  const storyIndex = useContext(StoryIndexContext);
  const withRef = storyIndex.filter(s => !!s.ref);
  const sorted = withRef.sort(sortByDOMOrder);

  return (
    <div>
      {sorted.map(s => (
        <div key={s.id}>
          <a href={`#${s.id}`}>{s.label}</a>
        </div>
      ))}
    </div>
  );
}
