window.MathJax = {
  loader: {
    load: ['ui/lazy']
  },
  tex: {
    inlineMath: [['$', '$']],
    tags: 'ams',
  },
};

var script = document.createElement('script');
script.src = "https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-svg.js";
script.async = true;
document.head.appendChild(script);

document.getElementById('upload-btn').addEventListener('click', e => {
  document.getElementById('upload-input').click();
})

document.getElementById('upload-input').addEventListener('change', () => {
  document.getElementById('upload-btn').style.display = 'none';
  upload_handler();
});

const md = new remarkable.Remarkable({
  html: true,
  breaks: false,
  langPrefix: 'language-',
});

function math_format(math) {
  return math.replace(/(<|>)/g, ' $1 ')
    .replace(/\\\\/g, '\\\\  ')
    .replace(/\\(R|C|Z|N)([^a-zA-Z])/g, '\\mathbb{$1}$2')
    .replace(/\\part([^i])/g, '\\partial$1')
    .replace(/(^\$\$|\$\$$)/g, '$$$$$$')
    .replaceAll('-AAAAAAA-', '\n')
    .replace(/\\bm ([a-zA-Z0-9])/g, '\\boldsymbol $1')
    .replace(/\\bm *(\\[a-zA-Z]+)/g, '\\boldsymbol$1')
    .replace(/\\bm *{(.*?)}/g, '\\boldsymbol{$1}')
    // .replace(/(\\[a-zA-Z]+) *(\\[a-zA-Z_\d]+)/g, '$1{$2}')
}

function upload_handler() {
  let file = document.getElementById('upload-input')?.files?.[0];
  if( !(file?.name.match(/\.(tex|md)$/)) ) return;
  let reader = new FileReader();
  reader.onload = function() {
    let result = this.result.replace(/\r\n/g, '\n').replace(/\\bm #1/g, '\\boldsymbol #1');
    // 将自定义的tex命令设置到tex.macros
    let cmds = {};
    result.match(/\\newcommand{(.*?)}(\[\d+\])?{(.*?)}\n/g)
      ?.forEach( cmd => {
          let match = cmd.match(/\\newcommand{\\(.*?)}(\[(\d+)\])?{(.*?)}\n/);
          cmds[match[1]] = [`{${match[4]}}`, match[3]];
    });
    console.log(cmds);
    if(window.MathJax?.config?.tex) {
      window.MathJax.config.tex.macros = cmds;
      window.MathJax.startup.getComponents();
    }

    result = result.replace(/\n/g, '-AAAAAAA-')
      .replace(/.*?\\begin{document}/, '')
      .replaceAll('dfrac', 'frac')
      .replace(/\\chapter{(.*?)}/g, '\n# $1\n')
      .replace(/\\section{(.*?)}/g, '\n## $1\n')
      .replace(/\\subsection{(.*?)}/g, '\n### $1\n')
      .replace(/\\begin{(lemma|theorem|proposition|proof|abstract)}/g, '\n**$1** &nbsp;&nbsp;')
      .replace(/\\end{(lemma|theorem|proposition|proof|abstract)}/g, '');
      
    // 匹配所有数学公式，将其中</>号前后加空格，不然会被解析为html标签。
    // 将每一个公式替换为EQUATION-id，然后使用remarkable解析md，之后再替换回来，
    // 使用MathJax渲染。
    // 需要注意 \text{ $...$ }
    let math_block = result.match(/\\begin{(equation|align|)\*?}.*?\\end{(equation|align|)\*?}/g) || [];
    math_block = math_block.map(math => {
      result = result.replace(math, 'EQUATION-TO-REPLACE2');
      return math_format(math);
    })
    let math_inline = result.match(/\${1,2}.+?\${1,2}/g) || [];
    math_inline = math_inline.map(math => {
      result = result.replace(math, 'EQUATION-TO-REPLACE1');
      return math_format(math);
    })

    result = result.replace(/(\n#+.*?\n)/g, '\n$1\n')
                   .replace(/\\/g, '')
                   .replace(/begin{(.*?)}(.*?)end{(.*?)}/g, '\n<span class="highlight">$1</span>: $2 \n')
                   .replace(/bibitem{(.*?)}/g, '- **$1**')
                   .replace(/cite{(.*?)}/g, '[<u style="color: blue;">$1</u>]')
                   .replaceAll('eqref', '\\eqref')
                   .replaceAll('-AAAAAAA-', '\n')
    result = md.render(result);

    math_inline.forEach(math => {
      result = result.replace('EQUATION-TO-REPLACE1', math);
    })
    math_block.forEach(math => {
      result = result.replace('EQUATION-TO-REPLACE2', math);
    })

    // 处理标签多次出现的渲染错误
    result = result.replace(/\\label{}/g, '');
    let sub_result = result;
    let idx = 0;
    while (true) {
      let label = sub_result.match(/\\label{.*?}/);
      if (!label) break;
      idx += label.index + label[0].length;
      sub_result = result.slice(idx);
      result = result.slice(0, idx) + sub_result.replaceAll(label[0], '');
    }

    document.getElementById('container').innerHTML = result;

    window.MathJax.typesetPromise([document.getElementById('container')])
  }
  reader.readAsText(file);
}