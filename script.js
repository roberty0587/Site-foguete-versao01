// CONSTANTES FÍSICAS
const GRAVIDADE = 9.81; // Aceleração da gravidade terrestre (m/s²)

// ELEMENTOS DO DOM
const formulario = document.getElementById('formulario-simulacao');
const campoAngulo = document.getElementById('angulo');
const campoPressao = document.getElementById('pressao');

const btnSimular = document.getElementById('btn-simular');
const btnLimpar = document.getElementById('btn-limpar');
const btnAnimar = document.getElementById('btn-animar');

const elemAlcance = document.getElementById('res-alcance');
const elemAltura = document.getElementById('res-altura');
const elemTempo = document.getElementById('res-tempo');
const elemVelocidade = document.getElementById('res-velocidade');

const canvas = document.getElementById('canvas-trajetoria');
const ctx = canvas.getContext('2d');
const corpoTabela = document.getElementById('corpo-tabela-historico');

// VARIÁVEIS DE ESTADO
let resultadoAtual = null;
let historicoSimulacoes = [];
let idAnimacao = null;

// ESTIMATIVA DE VELOCIDADE A PARTIR DA PRESSÃO
// Modelo empírico aproximado para garrafas PET típicas
function estimarVelocidadeInicial(pressaoBar) {
    // Estimativa experimental baseada em pressão de ar comprimido
    return 14.0 * Math.sqrt(pressaoBar);
}

// CÁLCULO FÍSICO DO MOVIMENTO OBLÍQUO
function calcularTrajetoria(anguloGraus, pressaoBar) {
    const anguloRadianos = (anguloGraus * Math.PI) / 180;
    const v0 = estimarVelocidadeInicial(pressaoBar);

    // Componentes da velocidade inicial
    const vx = v0 * Math.cos(anguloRadianos);
    const vy = v0 * Math.sin(anguloRadianos);

    // Tempos e métricas principais
    const tempoSubida = vy / GRAVIDADE;
    const tempoTotal = 2 * tempoSubida;
    const alturaMaxima = (vy * vy) / (2 * GRAVIDADE);
    const alcanceHorizontal = vx * tempoTotal;

    // Gerar pontos da trajetória para o gráfico
    const pontos = [];
    const passos = 100;
    for (let i = 0; i <= passos; i++) {
        const t = (tempoTotal / passos) * i;
        const x = vx * t;
        const y = (vy * t) - (0.5 * GRAVIDADE * t * t);
        pontos.push({ x: x, y: Math.max(0, y) });
    }

    return {
        angulo: anguloGraus,
        pressao: pressaoBar,
        v0: v0,
        vx: vx,
        vy: vy,
        tempoTotal: tempoTotal,
        alturaMaxima: alturaMaxima,
        alcanceHorizontal: alcanceHorizontal,
        pontos: pontos
    };
}

// EXIBIR RESULTADOS NA TELA
function atualizarInterfaceResultados(dados) {
    elemAlcance.innerHTML = `${dados.alcanceHorizontal.toFixed(1)} <small>m</small>`;
    elemAltura.innerHTML = `${dados.alturaMaxima.toFixed(1)} <small>m</small>`;
    elemTempo.innerHTML = `${dados.tempoTotal.toFixed(2)} <small>s</small>`;
    elemVelocidade.innerHTML = `${dados.v0.toFixed(1)} <small>m/s</small>`;

    btnAnimar.disabled = false;
}

// DESENHAR O GRÁFICO DA TRAJETÓRIA NO CANVAS
function desenharGrafico(dados) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const margem = 40;
    const larguraUtil = canvas.width - 2 * margem;
    const alturaUtil = canvas.height - 2 * margem;

    // Escalas de conversão de metros para pixels
    const maxMetersX = Math.max(dados.alcanceHorizontal * 1.1, 10);
    const maxMetersY = Math.max(dados.alturaMaxima * 1.2, 5);

    const scaleX = larguraUtil / maxMetersX;
    const scaleY = alturaUtil / maxMetersY;

    // Função para converter coordenadas de metros para pixels no Canvas
    function paraPixel(x, y) {
        return {
            px: margem + x * scaleX,
            py: canvas.height - margem - y * scaleY
        };
    }

    // Desenhar eixos
    ctx.strokeStyle = '#3a506b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(margem, canvas.height - margem);
    ctx.lineTo(canvas.width - margem, canvas.height - margem); // Eixo X
    ctx.moveTo(margem, canvas.height - margem);
    ctx.lineTo(margem, margem); // Eixo Y
    ctx.stroke();

    // Desenhar curva da trajetória
    ctx.strokeStyle = '#48cae4';
    ctx.lineWidth = 3;
    ctx.beginPath();
    dados.pontos.forEach((ponto, i) => {
        const { px, py } = paraPixel(ponto.x, ponto.y);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
    });
    ctx.stroke();

    // Marcar altura máxima
    const ptApex = paraPixel(dados.alcanceHorizontal / 2, dados.alturaMaxima);
    ctx.fillStyle = '#ff9e00';
    ctx.beginPath();
    ctx.arc(ptApex.px, ptApex.py, 6, 0, Math.PI * 2);
    ctx.fill();

    // Texto da altura máxima
    ctx.fillStyle = '#ffffff';
    ctx.font = '12px sans-serif';
    ctx.fillText(`H. Máx: ${dados.alturaMaxima.toFixed(1)}m`, ptApex.px - 30, ptApex.py - 12);
}

// ANIMAÇÃO DO LANÇAMENTO
function iniciarAnimacao() {
    if (!resultadoAtual) return;

    if (idAnimacao) cancelAnimationFrame(idAnimacao);

    let inicioTempo = null;
    const duracaoAnimacao = 2500; // 2.5 segundos de animação visual

    function passoAnimacao(timestamp) {
        if (!inicioTempo) inicioTempo = timestamp;
        const progresso = (timestamp - inicioTempo) / duracaoAnimacao;

        desenharGrafico(resultadoAtual);

        if (progresso <= 1) {
            const indicePonto = Math.min(
                Math.floor(progresso * (resultadoAtual.pontos.length - 1)),
                resultadoAtual.pontos.length - 1
            );
            const ponto = resultadoAtual.pontos[indicePonto];

            // Re-calcular escala
            const margem = 40;
            const maxMetersX = Math.max(resultadoAtual.alcanceHorizontal * 1.1, 10);
            const maxMetersY = Math.max(resultadoAtual.alturaMaxima * 1.2, 5);
            const scaleX = (canvas.width - 2 * margem) / maxMetersX;
            const scaleY = (canvas.height - 2 * margem) / maxMetersY;

            const px = margem + ponto.x * scaleX;
            const py = canvas.height - margem - ponto.y * scaleY;

            // Desenhar o foguete em movimento
            ctx.fillStyle = '#ff4d6d';
            ctx.beginPath();
            ctx.arc(px, py, 8, 0, Math.PI * 2);
            ctx.fill();

            idAnimacao = requestAnimationFrame(passoAnimacao);
        }
    }

    idAnimacao = requestAnimationFrame(passoAnimacao);
}

// ADICIONAR REGISTRO NA TABELA DE HISTÓRICO
function adicionarAoHistorico(dados) {
    historicoSimulacoes.unshift(dados);
    corpoTabela.innerHTML = '';

    historicoSimulacoes.forEach((item, index) => {
        const linha = document.createElement('tr');
        linha.innerHTML = `
            <td>${historicoSimulacoes.length - index}</td>
            <td>${item.angulo}°</td>
            <td>${item.pressao.toFixed(1)}</td>
            <td>${item.v0.toFixed(1)}</td>
            <td>${item.alturaMaxima.toFixed(1)}</td>
            <td>${item.alcanceHorizontal.toFixed(1)}</td>
            <td>${item.tempoTotal.toFixed(2)}</td>
        `;
        corpoTabela.appendChild(linha);
    });
}

// PROCESSAR EVENTO DE SIMULAÇÃO
formulario.addEventListener('submit', (evento) => {
    evento.preventDefault();

    const angulo = parseFloat(campoAngulo.value);
    const pressao = parseFloat(campoPressao.value);

    // Validação de entradas
    if (isNaN(angulo) || angulo < 15 || angulo > 80) {
        alert('Por favor, informe um ângulo entre 15° e 80°.');
        return;
    }

    if (isNaN(pressao) || pressao <= 0) {
        alert('Por favor, informe uma pressão válida e maior que zero.');
        return;
    }

    resultadoAtual = calcularTrajetoria(angulo, pressao);
    atualizarInterfaceResultados(resultadoAtual);
    desenharGrafico(resultadoAtual);
    adicionarAoHistorico(resultadoAtual);
});

// REINICIAR/LIMPAR FORMULÁRIO E TELA
btnLimpar.addEventListener('click', () => {
    campoAngulo.value = 45;
    campoPressao.value = 3.0;

    resultadoAtual = null;
    if (idAnimacao) cancelAnimationFrame(idAnimacao);

    elemAlcance.innerHTML = '0.0 <small>m</small>';
    elemAltura.innerHTML = '0.0 <small>m</small>';
    elemTempo.innerHTML = '0.0 <small>s</small>';
    elemVelocidade.innerHTML = '0.0 <small>m/s</small>';

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    btnAnimar.disabled = true;
});

// BOTAO DE ANIMAÇÃO
btnAnimar.addEventListener('click', iniciarAnimacao);