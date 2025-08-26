import {useCallback, useEffect, useRef, useState} from 'react';
import styled from '@emotion/styled';

import campingImg from 'sentry-images/spot/onboarding-preview.svg';

import {navigateTo} from 'sentry/actionCreators/navigation';
import {ExternalLink} from 'sentry/components/core/link';
import {IconSentry} from 'sentry/icons/iconSentry';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import useRouter from 'sentry/utils/useRouter';

function NoIssuesMatched() {
  const organization = useOrganization();
  const router = useRouter();

  const location = useLocation();
  const onBreachedMetricsView = location.pathname.endsWith('/issues/breached-metrics/');
  const onWarningsView = location.pathname.endsWith('/issues/warnings/');
  const onErrorsAndOutagesView = location.pathname.endsWith('/issues/errors-outages/');

  return (
    <Wrapper data-test-id="empty-state" className="empty-state">
      <LeftColumn>
        <img src={campingImg} alt="Camping spot illustration" height={200} />
      </LeftColumn>
      <MessageContainer>
        <h3>{t('No issues match your search')}</h3>
        <div>{t('If this is unexpected, check out these tips:')}</div>
        <Tips>
          <li>{t('Double check your project, environment, and date filters')}</li>
          <li>
            {tct('Make sure your search has the right syntax. [link]', {
              link: (
                <ExternalLink href="https://docs.sentry.io/concepts/search/">
                  {t('Learn more')}
                </ExternalLink>
              ),
            })}
          </li>
          <li>
            {tct(
              "Check your [filterSettings: inbound data filters] to make sure the events aren't being filtered out",
              {
                filterSettings: (
                  <a
                    href="#"
                    onClick={event => {
                      event.preventDefault();
                      const url = `/settings/${organization.slug}/projects/:projectId/filters/data-filters/`;
                      if (router) {
                        navigateTo(url, router);
                      }
                    }}
                  />
                ),
              }
            )}
          </li>
          {(onBreachedMetricsView || onWarningsView) && (
            <li>
              {tct('Make sure [link] is set up in your project.', {
                link: (
                  <ExternalLink href="https://docs.sentry.io/platform-redirect/?next=%2Ftracing%2F">
                    {t('tracing')}
                  </ExternalLink>
                ),
              })}
            </li>
          )}
          {onErrorsAndOutagesView && (
            <li>
              {tct(
                'Make sure [uptimeLink] and [cronsLink] monitoring is set up in your project.',
                {
                  uptimeLink: (
                    <ExternalLink href="https://docs.sentry.io/product/alerts/uptime-monitoring/">
                      {t('uptime')}
                    </ExternalLink>
                  ),
                  cronsLink: (
                    <ExternalLink href="https://docs.sentry.io/platform-redirect/?next=%2Fcrons%2F">
                      {t('cron')}
                    </ExternalLink>
                  ),
                }
              )}
            </li>
          )}
        </Tips>
      </MessageContainer>
      <RunnerGame />
    </Wrapper>
  );
}

export default NoIssuesMatched;

const Wrapper = styled('div')`
  display: flex;
  justify-content: center;
  font-size: ${p => p.theme.fontSize.lg};
  border-radius: 0 0 3px 3px;
  padding: 40px ${space(3)};
  min-height: 260px;
  position: relative;

  @media (max-width: ${p => p.theme.breakpoints.sm}) {
    flex-direction: column;
    align-items: center;
    padding: ${space(3)};
    text-align: center;
  }
`;

const LeftColumn = styled('div')`
  display: flex;
  flex-direction: column;
  align-items: center;
`;

const MessageContainer = styled('div')`
  align-self: center;
  max-width: 480px;
  margin-left: 40px;

  @media (max-width: ${p => p.theme.breakpoints.sm}) {
    margin: 0;
  }
`;

const Tips = styled('ul')`
  text-align: left;
`;

// --- Easter egg: tiny runner game ---
function RunnerGame() {
  // Game dims
  const height = 96;
  const groundY = height - 2; // separator line at bottom
  const triSize = 17;
  const startX = 36;
  const gravity = 0.1715; // scale gravity by 0.7^2 to preserve jump height with reduced v0
  const jumpVelocity = -5.25;
  const baseSpeed = 1.92; // 80% of previous base

  const [visible, setVisible] = useState(false);
  const [running, setRunning] = useState(false);
  const crashedRef = useRef(false);
  const crashXRef = useRef<number | null>(null);
  // Force a re-render each frame even if player position doesn't change
  const [, setFrame] = useState(0);
  const [playerY, setPlayerY] = useState(groundY - triSize);
  const [playerX, setPlayerX] = useState(startX);
  const [playerRot, setPlayerRot] = useState(0);
  const vyRef = useRef(0);
  const startTimeRef = useRef<number | null>(null);
  const [survivalMs, setSurvivalMs] = useState(0);
  const [bestMs, setBestMs] = useState(0);
  const [speedLevel, setSpeedLevel] = useState(1);
  type Obstacle = {h: number; kind: 'bug' | 'alert'; w: number; x: number; y: number};
  const obstaclesRef = useRef<Obstacle[]>([]);
  const rafRef = useRef<number | null>(null);
  const lastSpawnRef = useRef<number>(0);
  const lastTimeRef = useRef<number | null>(null);
  const gameRef = useRef<HTMLDivElement | null>(null);
  const gameWidthRef = useRef<number>(0);
  const leftPressedRef = useRef(false);
  const rightPressedRef = useRef(false);
  const [intro, setIntro] = useState(false);
  const introStartRef = useRef<number | null>(null);
  const pausedRef = useRef(false);
  const pausedAtRef = useRef<number | null>(null);
  // Explosion state on crash
  const explosionRef = useRef<{
    progress: number;
    start: number;
    x: number;
    y: number;
  } | null>(null);
  // Music element
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Measure width once after the game becomes visible and do not update thereafter
  useEffect(() => {
    if (!visible) return () => {};
    const id = window.requestAnimationFrame(() => {
      const el = gameRef.current;
      if (!el) return;
      const w = Math.floor(el.clientWidth);
      if (w) {
        gameWidthRef.current = w;
      }
    });
    return () => window.cancelAnimationFrame(id);
  }, [visible]);

  const reset = useCallback(() => {
    obstaclesRef.current = [];
    vyRef.current = 0;
    setPlayerY(groundY - triSize);
    // Do not change playerX here; keep horizontal position
  }, [groundY, triSize]);

  const spawnObstacle = useCallback(
    (now: number, speedMultiplier: number) => {
      const since = now - lastSpawnRef.current;
      // Keep spatial density consistent: as speed increases, spawn more frequently in time
      const baseMin = 1100;
      const baseMax = 1900;
      const interval =
        (baseMin + Math.random() * (baseMax - baseMin)) / Math.max(1, speedMultiplier);
      if (since >= interval) {
        // Make obstacles larger and uniform so bug/alert are the same size
        const size = 24; // pixels
        const h = size;
        const w = size;
        // Spawn at the right edge (fully off-screen until first movement)
        const kind: 'bug' | 'alert' = Math.random() < 0.5 ? 'bug' : 'alert';
        // Random elevation: on floor or in air
        const air = Math.random() < 0.5;
        const airOffset = 36; // pixels above floor for air obstacles
        const yTop = air ? Math.max(0, groundY - h - airOffset) : groundY - h;
        obstaclesRef.current.push({
          x: Math.max(0, Math.floor((gameWidthRef.current || 420) - w - 1)),
          y: yTop,
          w,
          h,
          kind,
        });
        lastSpawnRef.current = now;
      }
    },
    [groundY]
  );

  const tick = useCallback(
    (now: number) => {
      // Keep the loop alive regardless of running state so left/right can work on ground
      if (lastTimeRef.current == null) {
        lastTimeRef.current = now;
      }

      // Intro animation: jump in with flips from below the barrier, disable gameplay during intro
      if (intro) {
        if (introStartRef.current === null) introStartRef.current = now;
        const dur = 1100; // ms for a fuller arc
        const introT = Math.min(1, (now - introStartRef.current) / dur);
        const baseY = groundY - triSize;
        const offsetBelow = 16; // how far below the ground we start
        const introHeight = 54; // how high above ground at apex
        // Smooth arc that starts below the barrier, peaks mid-way, and lands exactly at baseY
        const y =
          introT < 1
            ? baseY +
              offsetBelow * (1 - introT) -
              introHeight * Math.sin(Math.PI * introT)
            : baseY;
        setPlayerY(y);
        setPlayerRot(900 * introT);
        if (introT >= 1) {
          setPlayerY(baseY);
          setPlayerRot(0);
          setIntro(false);
          setRunning(true);
          startTimeRef.current = now;
          setSurvivalMs(0);
          vyRef.current = 0;
          lastSpawnRef.current = now;
          lastTimeRef.current = now;
        }
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      // Update survival timer only while running
      if (running) {
        if (startTimeRef.current === null) startTimeRef.current = now;
        const elapsed = startTimeRef.current ? now - startTimeRef.current : 0;
        setSurvivalMs(elapsed);
        // Increase difficulty every 10s: speedLevel starts at 1 and increments
        const level = Math.floor(elapsed / 10000) + 1;
        if (level !== speedLevel) setSpeedLevel(level);
      }

      // Spawn only when auto-scrolling is active
      if (running) {
        const speedMultiplier = Math.pow(1.3, Math.max(0, speedLevel - 1));
        spawnObstacle(now, speedMultiplier);
      }

      // Update player
      if (running) {
        vyRef.current += gravity;
        let newY = playerY + vyRef.current;
        if (newY >= groundY - triSize) {
          newY = groundY - triSize;
          vyRef.current = 0;
        }
        // Do not clamp at the top; let the arc progress naturally. The GameArea will clip visually.
        setPlayerY(newY);
      }

      // Horizontal player movement (left/right pressed)
      const horizontal =
        (rightPressedRef.current ? 1 : 0) - (leftPressedRef.current ? 1 : 0);
      // Disable horizontal movement if the game isn't running (e.g., after a crash)
      if (running && horizontal !== 0) {
        const step = 1.75; // +25% horizontal speed
        // No special wall logic: free horizontal movement; final clamp happens below
        const nx = playerX + horizontal * step;
        if (nx !== playerX) setPlayerX(nx);
      }

      // Move obstacles and drop those that exit left edge
      if (running) {
        obstaclesRef.current = obstaclesRef.current
          .map(o => {
            // Each speed level increases base speed by 30%
            const currentSpeed = baseSpeed * Math.pow(1.3, Math.max(0, speedLevel - 1));
            return {...o, x: o.x - currentSpeed};
          })
          .filter(o => o.x + o.w > 0);
      }

      // Collision (AABB vs triangle bbox)
      if (running) {
        const px = playerX - triSize * 0.25; // bbox padding backward a bit
        const py = playerY + vyRef.current; // approximate next Y (matches newY when updated above)
        const pw = triSize * 0.95;
        const ph = triSize * 0.95;
        const hit = obstaclesRef.current.some(o => {
          const ox = o.x;
          const oy = o.y;
          return ox < px + pw && ox + o.w > px && oy < py + ph && oy + o.h > py;
        });
        if (hit) {
          // Freeze exactly where we touched: stop motion and keep current position
          setRunning(false);
          crashedRef.current = true;
          crashXRef.current = playerX;
          vyRef.current = 0;
          // Pause music on crash
          try {
            audioRef.current?.pause();
          } catch (_) {}
          // Start explosion at player's center
          explosionRef.current = {
            x: playerX + triSize / 2,
            y: playerY + triSize / 2,
            start: now,
            progress: 0,
          };
          // Record best time
          if (startTimeRef.current !== null) {
            const elapsed = now - startTimeRef.current;
            if (elapsed > bestMs) setBestMs(elapsed);
          }
          // Stop timer
          startTimeRef.current = null;
        }
      }

      // Animate explosion if active
      if (explosionRef.current) {
        const explT = Math.min(1, (now - explosionRef.current.start) / 600);
        explosionRef.current.progress = explT;
        if (explT >= 1) {
          explosionRef.current = null;
        }
      }

      // Force a paint so obstacle positions update even when player is idle on ground
      setFrame(f => (f + 1) % 1000000);

      // Global clamp each frame: keep playerX within left/right walls
      if (running) {
        const gw = gameWidthRef.current;
        if (gw && gw > 0) {
          const leftWallX = 0;
          const rightWallX = Math.max(0, gw - triSize - 1); // fixed bound from cached width
          let clampedX = playerX;
          if (clampedX < leftWallX) {
            clampedX = leftWallX;
          } else if (clampedX > rightWallX) {
            clampedX = rightWallX;
          }
          // Minimal anti-jitter: if very close to a wall, snap exactly to it
          if (Math.abs(clampedX - leftWallX) < 0.5) clampedX = leftWallX;
          else if (Math.abs(clampedX - rightWallX) < 0.5) clampedX = rightWallX;
          if (clampedX !== playerX) setPlayerX(clampedX);
        }
      }
      // While crashed, lock X exactly where we hit
      if (!running && crashedRef.current && crashXRef.current !== null) {
        if (playerX !== crashXRef.current) setPlayerX(crashXRef.current);
      }

      rafRef.current = requestAnimationFrame(tick);
    },
    [
      gravity,
      groundY,
      playerX,
      playerY,
      running,
      spawnObstacle,
      baseSpeed,
      speedLevel,
      triSize,
    ]
  );

  // Pause/resume on tab visibility changes: stop RAF and exclude hidden time from timers
  useEffect(() => {
    const onVisibility = () => {
      if (!visible) return;
      if (document.hidden) {
        pausedRef.current = true;
        pausedAtRef.current = performance.now();
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      } else {
        if (!pausedRef.current) return;
        const now = performance.now();
        const pausedMs = pausedAtRef.current == null ? 0 : now - pausedAtRef.current;
        pausedRef.current = false;
        pausedAtRef.current = null;
        // Adjust timers so hidden time doesn't count
        if (intro && introStartRef.current != null) {
          introStartRef.current += pausedMs;
        }
        if (running && startTimeRef.current != null) {
          startTimeRef.current += pausedMs;
        }
        if (lastSpawnRef.current != null) {
          lastSpawnRef.current += pausedMs;
        }
        lastTimeRef.current = null; // reset delta baseline
        rafRef.current = requestAnimationFrame(tick);
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [intro, running, tick, visible]);

  const handleUp = useCallback(() => {
    if (!visible) {
      setVisible(true);
      setIntro(true);
      setRunning(false);
      lastSpawnRef.current = performance.now();
      lastTimeRef.current = null;
      // Measure width at start
      const el = gameRef.current;
      if (el) {
        const w = Math.floor(el.clientWidth);
        if (w) gameWidthRef.current = w;
      }
      // Start intro timer; gameplay timer starts after intro ends
      introStartRef.current = performance.now();
      setSurvivalMs(0);
      rafRef.current = requestAnimationFrame(tick);
      // Start music on first ArrowUp (user gesture)
      try {
        audioRef.current?.play();
      } catch (_) {}
      return;
    }
    if (!running) {
      if (crashedRef.current) {
        crashedRef.current = false;
        reset();
        crashXRef.current = null;
        explosionRef.current = null;
      }
      setRunning(true);
      lastSpawnRef.current = performance.now();
      lastTimeRef.current = null;
      // Restart survival timer
      startTimeRef.current = performance.now();
      setSurvivalMs(0);
      // Ensure music is playing on restart
      try {
        audioRef.current?.play();
      } catch (_) {}
      rafRef.current = requestAnimationFrame(tick);
      return;
    }
    // Jump if near ground
    if (Math.abs(playerY - (groundY - triSize)) < 0.5) {
      vyRef.current = jumpVelocity;
    }
  }, [groundY, playerY, reset, running, tick, triSize, visible]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        handleUp();
      } else if (e.key === 'ArrowLeft') {
        if (!running) return;
        leftPressedRef.current = true;
      } else if (e.key === 'ArrowRight') {
        if (!running) return;
        rightPressedRef.current = true;
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        leftPressedRef.current = false;
      } else if (e.key === 'ArrowRight') {
        rightPressedRef.current = false;
      }
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [handleUp, running]);

  useEffect(() => {
    if (!visible) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      return;
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [visible, tick]);

  if (!visible) {
    return null;
  }

  return (
    <GameArea role="presentation" aria-hidden ref={gameRef}>
      <Stats>
        <div>Survival: {Math.floor(survivalMs / 1000)}s</div>
        <div>Best: {Math.floor(bestMs / 1000)}s</div>
        <div>Speed: {speedLevel}</div>
      </Stats>
      <Separator />
      {/* Hidden looping audio started by ArrowUp (user gesture) */}
      <audio
        ref={audioRef}
        src="https://ia803209.us.archive.org/35/items/GuileTheme/Guile%20Theme.mp3"
        preload="auto"
        loop
        style={{display: 'none'}}
      />
      <Player
        style={{
          left: `${playerX}px`,
          top: `${playerY}px`,
          transform: `rotate(${playerRot}deg)`,
          // Subtle run animation when on ground
          filter:
            running && Math.abs(playerY - (groundY - triSize)) < 0.5
              ? 'brightness(1.05)'
              : 'none',
        }}
      >
        <PlayerIcon />
      </Player>
      {obstaclesRef.current.map((o, i) => (
        <ObstacleIcon key={i} x={o.x} y={o.y} w={o.w} h={o.h} kind={o.kind} />
      ))}
      {explosionRef.current && (
        <ExplosionIcon
          x={explosionRef.current.x}
          y={explosionRef.current.y}
          progress={explosionRef.current.progress}
        />
      )}
    </GameArea>
  );
}

const GameArea = styled('div')`
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 96px;
  overflow-x: hidden;
  overflow-y: visible;
  z-index: 3;
`;
const Stats = styled('div')`
  position: absolute;
  top: 4px;
  left: 8px;
  font-size: ${p => p.theme.fontSize.sm};
  color: ${p => p.theme.subText};
  display: flex;
  gap: ${space(1)};
  z-index: 4;
`;

const Separator = styled('div')`
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 2px;
  background: ${p => p.theme.purple300};
  opacity: 0.4;
`;

const Player = styled('div')`
  position: absolute;
  width: 17px;
  height: 17px;
  color: ${p => p.theme.purple300};
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2;
`;

const PlayerIcon = styled(IconSentry)`
  width: 17px;
  height: 17px;
`;

type ObstacleIconProps = {
  h: number;
  kind: 'bug' | 'alert';
  w: number;
  x: number;
  y: number;
};

function ObstacleIcon({x, y, w, h, kind}: ObstacleIconProps) {
  const fill = '#F43F5E'; // red for both bug and alert
  const outline = '#000'; // black outline
  // Simple SVG paths: a beetle-like icon and a triangle alert icon
  return (
    <svg
      style={{position: 'absolute', left: `${x}px`, top: `${y}px`, zIndex: 2}}
      width={w}
      height={h}
      viewBox="0 0 24 24"
      aria-hidden
    >
      {kind === 'bug' ? (
        // Minimal beetle: body + legs
        <g
          fill={fill}
          stroke={outline}
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <ellipse cx="12" cy="13" rx="6" ry="7" fill={fill} />
          <path d="M6 10 L3 9" />
          <path d="M6 14 L3 15" />
          <path d="M18 10 L21 9" />
          <path d="M18 14 L21 15" />
          <path d="M12 4 V2" />
        </g>
      ) : (
        // Minimal alert bell
        <g
          fill={fill}
          stroke={outline}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {/* Bell dome and body */}
          <path
            d="M12 3c-3 0-5 2.3-5 5.2V12l-1.8 2.4c-.3.4 0 .8.5.8H18.3c.5 0 .8-.4.5-.8L17 12V8.2C17 5.3 15 3 12 3Z"
            fill={fill}
          />
          {/* Clapper */}
          <circle cx="12" cy="18" r="1.6" />
        </g>
      )}
    </svg>
  );
}

type ExplosionIconProps = {progress: number; x: number; y: number};

function ExplosionIcon({x, y, progress}: ExplosionIconProps) {
  // progress: 0 -> 1 over 600ms
  const maxR = 26; // radius
  const r = maxR * progress;
  const opacity = 1 - progress;
  const burst = 8; // number of rays
  const rays = Array.from({length: burst}).map((_, i) => {
    const a = (i / burst) * Math.PI * 2;
    const len = r * 1.2;
    const x2 = Math.cos(a) * len;
    const y2 = Math.sin(a) * len;
    return (
      <line
        key={i}
        x1={0}
        y1={0}
        x2={x2}
        y2={y2}
        stroke="#F43F5E"
        strokeWidth={2}
        strokeOpacity={opacity}
      />
    );
  });
  return (
    <svg
      style={{
        position: 'absolute',
        left: `${x}px`,
        top: `${y}px`,
        transform: 'translate(-50%, -50%)',
        zIndex: 3,
        pointerEvents: 'none',
      }}
      width={maxR * 3}
      height={maxR * 3}
      viewBox={`${-maxR * 1.5} ${-maxR * 1.5} ${maxR * 3} ${maxR * 3}`}
      aria-hidden
    >
      <circle cx={0} cy={0} r={r} fill="#F43F5E" fillOpacity={0.35 * opacity} />
      <circle
        cx={0}
        cy={0}
        r={Math.max(0, r - 6)}
        fill="#FDB1BC"
        fillOpacity={0.25 * opacity}
      />
      {rays}
    </svg>
  );
}

// Removed hint per request
