import React, { useEffect, useState } from 'react';

export default function PageTransition({ children, transitionKey }) {
  const [displayChildren, setDisplayChildren] = useState(children);
  const [stage, setStage] = useState('visible');
  const [currentKey, setCurrentKey] = useState(transitionKey);

  if (transitionKey !== currentKey) {
    setCurrentKey(transitionKey);
    setStage('hidden');
  }

  useEffect(() => {
    if (stage === 'hidden') {
      const t1 = setTimeout(() => {
        setDisplayChildren(children);
        setStage('visible');
      }, 180);
      return () => clearTimeout(t1);
    }
  }, [stage, children]);

  useEffect(() => {
    if (stage === 'visible') {
      setDisplayChildren(children);
    }
  }, [children, stage]);

  const styles = {
    hidden: {
      opacity: 0,
      filter: 'blur(4px)',
      transform: 'translateY(6px)',
      transition: 'opacity 180ms ease-out, filter 180ms ease-out, transform 180ms ease-out',
    },
    visible: {
      opacity: 1,
      filter: 'blur(0px)',
      transform: 'translateY(0px)',
      transition: 'opacity 200ms ease-out, filter 200ms ease-out, transform 200ms ease-out',
    },
  };

  return (
    <div style={{ ...styles[stage], willChange: 'opacity, filter, transform', height: '100%' }}>
      {displayChildren}
    </div>
  );
}
