import {useCallback, useEffect, useState} from 'react';
import styled from '@emotion/styled';
import {AnimatePresence, motion} from 'framer-motion';

import {Text} from 'sentry/components/core/text';

interface ChatMessage {
  content: string;
  user: {
    avatar: string;
    name: string;
  };
  isTyping?: boolean;
  timestamp?: string;
}

const DEMO_SCRIPT: ChatMessage[] = [
  {
    user: {
      name: 'leander',
      avatar: 'https://avatars.githubusercontent.com/u/35509934?s=96&v=4',
    },
    content: 'hey is the site like slow af',
  },
  {
    user: {
      name: 'leander',
      avatar: 'https://avatars.githubusercontent.com/u/35509934?s=96&v=4',
    },
    content: "oh it's 500ing lmao, /smokey new",
  },
  {
    user: {
      name: 'Sentry',
      avatar: 'https://avatars.githubusercontent.com/u/1396951?s=200&v=4',
    },
    content:
      '@leander has declared an incident, join the discussion in #inc-123. Would you like to publish a status update?',
  },
  {
    user: {
      name: 'leander',
      avatar: 'https://avatars.githubusercontent.com/u/35509934?s=96&v=4',
    },
    content: 'right right, forgot about that, /smokey status update',
  },
  {
    user: {
      name: 'Sentry',
      avatar: 'https://avatars.githubusercontent.com/u/1396951?s=200&v=4',
    },
    content: '@leander has published a Statuspage update "shit\'s on fire"',
  },
];

export function SlackDemo() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentStep, setCurrentStep] = useState(0);

  const addNextMessage = useCallback(() => {
    if (currentStep < DEMO_SCRIPT.length) {
      const message = DEMO_SCRIPT[currentStep];
      if (message) {
        setMessages(prev => [
          ...prev,
          {
            timestamp: Date.now().toString(),
            content: message.content,
            user: message.user,
            isTyping: true,
          },
        ]);
        setCurrentStep(prev => prev + 1);
      }
    }
  }, [currentStep]);

  // Start the demo with the first message
  useEffect(() => {
    if (messages.length === 0) {
      addNextMessage();
    }
  }, [addNextMessage, messages.length]);

  const resetDemo = () => {
    setMessages([]);
    setCurrentStep(0);
  };

  return (
    <SlackWindow onDoubleClick={resetDemo}>
      <SlackChannelBar top={15} />
      <SlackChannelBar top={30} />
      <SlackChannel top={45}>#inc</SlackChannel>
      <SlackChannelBar top={75} />
      <SlackChannelBar top={90} />
      <AnimatePresence>
        {messages.map((message, index) => (
          <motion.div
            key={index}
            initial={{opacity: 0, y: 20}}
            animate={{opacity: 1, y: 0}}
            transition={{duration: 0.3, delay: index * 0.1}}
          >
            <SlackMessage>
              <SlackDisplayPic src={message.user.avatar} />
              <SlackName>{message.user.name}</SlackName>
              <SlackTime>
                {new Date().toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}
              </SlackTime>
              <SlackText>
                {message.isTyping ? (
                  <TypewriterText
                    content={message.content}
                    isBot={message.user.name === 'Sentry'}
                    onComplete={() => {
                      // When typewriter completes, add next message if this is the last one
                      if (currentStep < DEMO_SCRIPT.length) {
                        setTimeout(addNextMessage, 400);
                      }
                    }}
                  />
                ) : (
                  message.content
                )}
              </SlackText>
            </SlackMessage>
          </motion.div>
        ))}
      </AnimatePresence>
    </SlackWindow>
  );
}

function TypewriterText({
  content,
  onComplete,
  isBot,
}: {
  content: string;
  isBot?: boolean;
  onComplete?: () => void;
}) {
  const [displayedText, setDisplayedText] = useState(isBot ? content : '');
  const [currentIndex, setCurrentIndex] = useState(isBot ? content.length : 0);
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    if (currentIndex < content.length) {
      const timer = setTimeout(() => {
        setDisplayedText(prev => prev + content[currentIndex]);
        setCurrentIndex(prev => prev + 1);
      }, 60);
      return () => clearTimeout(timer);
    }
    if (currentIndex === content.length && !isComplete) {
      setIsComplete(true);
      onComplete?.();
    }
    return undefined;
  }, [currentIndex, content, isComplete, onComplete]);

  return (
    <Text>
      {displayedText}
      {!isComplete && !isBot && (
        <motion.span
          animate={{opacity: [1, 0]}}
          transition={{duration: 0.5, repeat: Infinity}}
          style={{marginLeft: '2px'}}
        >
          |
        </motion.span>
      )}
    </Text>
  );
}
const SlackWindow = styled('div')`
  transform: translateY(-22px) perspective(600px) rotateX(20deg) rotateY(-15deg);
  display: flex;
  flex-direction: column;
  justify-content: end;
  gap: ${p => p.theme.space.lg};

  box-shadow:
    0 8px 32px 0 rgba(80, 38, 82, 0.18),
    0 1.5px 0 0 #fff2 inset,
    1px 1px 0 1px #3b0d3d11;
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(8px);

  position: relative;
  border-radius: ${p => p.theme.borderRadius};
  height: 260px;
  width: 650px;
  padding-bottom: 8px;
  overflow: hidden;

  &:before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    width: 20px;
    height: 100%;
    background: #3b0d3d;
  }
  &:after {
    content: '';
    position: absolute;
    top: 0;
    left: 20px;
    width: 80px;
    height: 100%;
    background: #4f2552;
  }
`;

const SlackChannelBar = styled('div')<{top: number}>`
  content: '';
  position: absolute;
  left: 25px;
  top: ${p => p.top}px;
  width: 70px;
  height: 4px;
  border-radius: 4px;
  background: #f9edff88;
  z-index: 1;
`;

const SlackChannel = styled('div')<{top: number}>`
  position: absolute;
  left: 25px;
  top: ${p => p.top}px;
  width: 70px;
  border-radius: 4px;
  padding: 2px 4px;
  background: #f9edff;
  color: #3b0d3d;
  font-weight: bold;
  font-size: 10px;
  z-index: 1;
`;

const SlackMessage = styled('div')`
  margin: 0 0 0 95px;
  padding: 0 14px 0 20px;
  display: grid;
  grid-template-columns: 30px 1fr auto;
  grid-template-rows: auto auto;
  column-gap: ${p => p.theme.space.md};
  &:hover {
    background: #f8f8f8;
  }
`;

const SlackDisplayPic = styled('img')`
  padding-top: 3px;
  width: 30px;
  height: 30px;
  border-radius: 8px;
  grid-row: 1 / 3;
`;

const SlackName = styled('div')`
  font-weight: ${p => p.theme.fontWeight.bold};
  font-size: ${p => p.theme.fontSize.md};
  grid-row: 1 / 2;
  grid-column: 2 / 3;
`;

const SlackText = styled('div')`
  grid-row: 2 / 3;
  grid-column: 2 / 3;
`;

const SlackTime = styled('div')`
  grid-row: 1 / 2;
  grid-column: 3 / 4;
  color: ${p => p.theme.tokens.content.muted};
  font-size: ${p => p.theme.fontSize.sm};
`;
