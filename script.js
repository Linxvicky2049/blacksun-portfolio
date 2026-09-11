(() => {
  const progress = document.querySelector('.progress span');
  const glow = document.querySelector('.cursor-glow');
  const tiltEls = document.querySelectorAll('.tilt');
  const menu = document.querySelector('.menu');
  const nav = document.querySelector('.nav');

  window.addEventListener('scroll', () => {
    const max = document.documentElement.scrollHeight - innerHeight;
    progress.style.width = `${max ? (scrollY / max) * 100 : 0}%`;
  }, {passive:true});

  window.addEventListener('pointermove', e => {
    glow.style.left = `${e.clientX}px`;
    glow.style.top = `${e.clientY}px`;
  }, {passive:true});

  tiltEls.forEach(card => {
    card.addEventListener('pointermove', e => {
      if (innerWidth < 800) return;
      const r = card.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - .5;
      const y = (e.clientY - r.top) / r.height - .5;
      card.style.transform = `perspective(900px) rotateX(${-y*7}deg) rotateY(${x*8}deg) translateY(-4px)`;
    });
    card.addEventListener('pointerleave', () => card.style.transform = '');
  });

  const observer = new IntersectionObserver(entries => entries.forEach(entry => {
    if (entry.isIntersecting) entry.target.classList.add('visible');
  }), {threshold:.12});
  document.querySelectorAll('.reveal').forEach(el => observer.observe(el));

  menu?.addEventListener('click', () => {
    nav.classList.toggle('mobile-open');
    nav.style.display = nav.classList.contains('mobile-open') ? 'flex' : '';
    nav.style.position = 'absolute';
    nav.style.top = '76px'; nav.style.left = '0'; nav.style.right = '0';
    nav.style.padding = '25px'; nav.style.background = 'rgba(7,8,13,.96)';
    nav.style.flexDirection = 'column';
  });

  // Three.js: a restrained interactive star/particle field that reacts to the pointer.
  if (window.THREE) {
    const canvas = document.getElementById('space');
    const renderer = new THREE.WebGLRenderer({canvas, antialias:true, alpha:true});
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6));
    renderer.setSize(innerWidth, innerHeight);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(55, innerWidth/innerHeight, .1, 1000);
    camera.position.z = 35;
    const geometry = new THREE.BufferGeometry();
    const count = 950;
    const positions = new Float32Array(count*3);
    const colors = new Float32Array(count*3);
    for(let i=0;i<count;i++){
      const i3=i*3, radius=18+Math.random()*45, a=Math.random()*Math.PI*2, b=(Math.random()-.5)*Math.PI;
      positions[i3]=Math.cos(a)*Math.cos(b)*radius;
      positions[i3+1]=Math.sin(b)*radius*.7;
      positions[i3+2]=Math.sin(a)*Math.cos(b)*radius;
      const c=new THREE.Color();
      c.setHSL(Math.random()<.68 ? .19 : (Math.random()<.5 ? .52 : .88), .75, .6);
      colors[i3]=c.r;colors[i3+1]=c.g;colors[i3+2]=c.b;
    }
    geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
    geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));
    const material=new THREE.PointsMaterial({size:.08,vertexColors:true,transparent:true,opacity:.55,blending:THREE.AdditiveBlending});
    const stars=new THREE.Points(geometry,material); scene.add(stars);
    const group=new THREE.Group(); scene.add(group);
    let mx=0,my=0;
    addEventListener('pointermove',e=>{mx=(e.clientX/innerWidth-.5)*.8;my=(e.clientY/innerHeight-.5)*.5},{passive:true});
    function animate(){requestAnimationFrame(animate);stars.rotation.y+=.00045;stars.rotation.x+=.00012;group.rotation.y+=(mx*.15-group.rotation.y)*.02;group.rotation.x+=(-my*.1-group.rotation.x)*.02;renderer.render(scene,camera)}
    animate();
    addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight)},{passive:true});
  }
})();
