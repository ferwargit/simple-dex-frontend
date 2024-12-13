import { ethers } from "https://cdnjs.cloudflare.com/ajax/libs/ethers/6.7.0/ethers.min.js";
import { CONFIG } from './config.js';

let provider, signer, address, simpleDexContract;
const simpleDexContractAddress = CONFIG.SIMPLE_DEX_CONTRACT_ADDRESS; // Dirección de tu contrato SimpleDEX
console.log("simpleDexContractAddress:", simpleDexContractAddress);
const simpleDexContractABI = CONFIG.SIMPLE_DEX_ABI;
console.log("simpleDexContractABI:", simpleDexContractABI);

// ABI global para tokens ERC20
let ERC20_ABI = null;

async function loadABI() {
    try {
        const response = await fetch('https://gist.githubusercontent.com/veox/8800debbf56e24718f9f483e1e40c35c/raw/f853187315486225002ba56e5283c1dba0556e6f/erc20.abi.json');

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const abi = await response.json();

        // Verificaciones adicionales
        if (!abi || !Array.isArray(abi)) {
            throw new Error("ABI inválido o vacío");
        }

        // Asignamos globalmente y registramos
        ERC20_ABI = abi;
        console.log("ABI cargado exitosamente:", abi.length, "métodos");

        return abi;
    } catch (error) {
        console.error("Error al cargar ABI:", error);
        ERC20_ABI = null; // Aseguramos que sea null en caso de error
        throw error; // Re-lanzamos para que el llamador pueda manejar el error
    }
}


async function updateTokenBalances() {
    try {
        // Verificamos que tengamos una wallet conectada y el contrato SimpleDex inicializado
        if (!address || !simpleDexContract) {
            console.error("No hay wallet conectada o contrato inicializado");
            return;
        }

        // Cargamos el ABI si no está disponible
        if (!ERC20_ABI) {
            await loadABI();
        }

        // Obtenemos las direcciones de los tokens desde el contrato SimpleDex
        const tokenAAddress = await simpleDexContract.tokenA();
        const tokenBAddress = await simpleDexContract.tokenB();

        // Verificamos que el ABI esté cargado
        if (!ERC20_ABI) {
            throw new Error("No se pudo cargar el ABI de ERC20");
        }

        // Creamos instancias de los contratos de tokens
        const tokenAContract = new ethers.Contract(tokenAAddress, ERC20_ABI, signer);
        const tokenBContract = new ethers.Contract(tokenBAddress, ERC20_ABI, signer);

        // Obtenemos los balances de los tokens
        const balanceA = await tokenAContract.balanceOf(address);
        const balanceB = await tokenBContract.balanceOf(address);

        // Obtenemos los símbolos y decimales de los tokens
        const symbolA = await tokenAContract.symbol();
        const symbolB = await tokenBContract.symbol();
        const decimalsA = await tokenAContract.decimals();
        const decimalsB = await tokenBContract.decimals();

        // Formateamos los balances
        const formattedBalanceA = ethers.formatUnits(balanceA, decimalsA);
        const formattedBalanceB = ethers.formatUnits(balanceB, decimalsB);

        // Actualizamos la interfaz de usuario
        document.getElementById("tokenABalance").textContent = `${symbolA} Balance: ${formattedBalanceA}`;
        document.getElementById("tokenBBalance").textContent = `${symbolB} Balance: ${formattedBalanceB}`;

        console.log(`Balances de tokens - ${symbolA}: ${formattedBalanceA}, ${symbolB}: ${formattedBalanceB}`);
    } catch (error) {
        console.error("Error al obtener balances de tokens:", error);

        // Reseteamos los elementos de la interfaz en caso de error
        document.getElementById("tokenABalance").textContent = "Token A Balance: Error";
        document.getElementById("tokenBBalance").textContent = "Token B Balance: Error";
    }
}


async function updateBalance() {
    try {
        // Verificamos que tengamos el provider y la dirección
        if (!provider || !address) {
            console.error("updateBalance - No hay provider o address");
            return;
        }

        // Obtenemos el balance de la wallet
        const balance = await provider.getBalance(address);
        // Convertimos el balance a ETH
        const formattedBalance = ethers.formatEther(balance);
        // Actualizamos el balance en la UI
        document.getElementById("ethBalance").textContent = `${formattedBalance} ETH`;

        console.log("updateBalance - Balance actualizado:", formattedBalance);
    } catch (error) {
        console.error("updateBalance - Error al actualizar el balance:", error);
    }
}


async function connectWallet() {
    // Estoy mostrando en la consola "Conectando a la wallet..." cuando se hace click en el botón para verificar la llamada a la función
    console.log("Conectando a la wallet...");

    if (window.ethereum) {
        // Estoy mostrando en la consola "Metamask detectado" cuando se detecta la wallet
        console.log("Metamask detectado");

        // Estoy obteniendo la cuenta de la wallet que se está conectando
        await window.ethereum.request({ method: "eth_requestAccounts" });
        // Estoy creando un nuevo proveedor para la wallet
        provider = new ethers.BrowserProvider(window.ethereum);
        // Hacemos un console.log del provider para ver las propiedades
        console.log("provider:", provider);
        // Estoy obteniendo el signer de la wallet
        signer = await provider.getSigner();
        // Hacemos un console.log del signer para ver las propiedades
        console.log("signer:", signer)
        // Estoy obteniendo la dirección de la wallet
        address = await signer.getAddress();
        // Hacemos un console.log de la dirección de la wallet
        console.log("connectWallet - address:", address);

        // Estoy ocultando el botón de conectar y mostrando el botón de desconectar
        document.getElementById("btnConnect").style.display = "none";
        document.getElementById("btnDisconnect").style.display = "block";

        // Estoy mostrando el estado de la wallet
        document.getElementById("status").innerText = `Estado: Conectado a la cuenta ${address}`;

        // Mostrar los balances cuando la wallet está conectada
        document.getElementById("ethBalanceSection").style.display = "block";
        // Mostrar balance de tokens
        document.getElementById("tokenBalancesSection").style.display = "block";

        // Estoy mostrando los campos de agregar liquidez, intercambiar tokens, retirar liquidez y obtener precio
        document.getElementById("addLiquiditySection").style.display = "block";
        document.getElementById("swapTokensSection").style.display = "block";
        document.getElementById("removeLiquiditySection").style.display = "block";
        document.getElementById("getPriceSection").style.display = "block";

        //  Mostrar Reservas y Precios
        document.getElementById("reservesSection").style.display = "block";
        document.getElementById("exchangeRateSection").style.display = "block";

        // Inicializamos el contrato SimpleDex
        await initializeSimpleDexContract();

        // Mostrar Direcciones de Tokens
        document.getElementById("tokensAddressSection").style.display = "block";
        document.getElementById("tokenAAddress").textContent = await simpleDexContract.tokenA();
        document.getElementById("tokenBAddress").textContent = await simpleDexContract.tokenB();

        // Actualizamos el balance de la wallet
        await updateBalance();
        // Actualizamos los balances de los tokens
        await updateTokenBalances();
        // Actualizamos la reserva de la wallet
        await updateReserves();
        // Actualizamos 
        await updateExchangeRate();

        // Estoy mostrando en la consola "Cuenta conectada" cuando se conecta la wallet
        console.log("connectWallet - Cuenta conectada");
    }
    else {
        // Estoy mostrando en la consola "Metamask no detectado" cuando no se detecta la wallet
        console.error("Metamask no detectado");
    }
}


async function initializeSimpleDexContract() {
    try {
        // Verificamos que tengamos el signer antes de inicializar el contrato
        if (!signer) {
            console.error("initializeSimpleDexContract - No hay signer disponible");
            return null;
        }

        // Cargamos el ABI del IERC20 si aun no esta cargado
        if (!ERC20_ABI) {
            console.log("Intentando cargar ABI en initializeSimpleDexContract...");
            try {
                await loadABI();
            } catch (loadError) {
                console.error("Error al cargar ABI en initializeSimpleDexContract:", loadError);
                return null;
            }
        }

        // Creamos la instancia del contrato usando ethers.js
        simpleDexContract = new ethers.Contract(
            simpleDexContractAddress,
            simpleDexContractABI,
            signer
        );

        console.log("SimpleDex Contract inicializado:", simpleDexContract);
        return simpleDexContract;
    } catch (error) {
        console.error("Error al inicializar el contrato SimpleDex:", error);
        return null;
    }
}


async function disconnectWallet() {
    console.log("Desconectando la wallet...");

    // Limpiamos el estado de la aplicación
    provider = null;
    signer = null;
    address = null;
    simpleDexContract = null;

    // Estoy ocultando el botón de desconectar y mostrando el botón de conectar
    document.getElementById("btnDisconnect").style.display = "none";
    document.getElementById("btnConnect").style.display = "block";

    // Actualizamos el estado
    document.getElementById("status").innerText = "Estado: Desconectado";

    // Ocultar los balances cuando la wallet está desconectada
    document.getElementById("ethBalanceSection").style.display = "none";
    // Ocultar balance de tokens
    document.getElementById("tokenBalancesSection").style.display = "none";

    document.getElementById("reservesSection").style.display = "none";
    document.getElementById("exchangeRateSection").style.display = "none";
    document.getElementById("tokensAddressSection").style.display = "none";

    // Ocultar los campos de agregar liquidez, intercambiar tokens, retirar liquidez y obtener precio
    document.getElementById("addLiquiditySection").style.display = "none";
    document.getElementById("swapTokensSection").style.display = "none";
    document.getElementById("removeLiquiditySection").style.display = "none";
    document.getElementById("getPriceSection").style.display = "none";

    console.log("disconnectWallet - Cuenta desconectada");
}


async function updateReserves() {
    try {
        if (!simpleDexContract) {
            simpleDexContract = new ethers.Contract(simpleDexContractAddress, simpleDexContractABI, provider);
        }

        // Leemos las reservas individualmente ya que son variables públicas
        const reserveA = await simpleDexContract.reserveA();
        const reserveB = await simpleDexContract.reserveB();

        document.getElementById("reserveA").innerText = `Reserva de Token A: ${ethers.formatUnits(reserveA, 18)}`;
        document.getElementById("reserveB").innerText = `Reserva de Token B: ${ethers.formatUnits(reserveB, 18)}`;

        console.log("updateReserves - Reservas actualizadas:", {
            reserveA: ethers.formatUnits(reserveA, 18),
            reserveB: ethers.formatUnits(reserveB, 18)
        });
    } catch (error) {
        console.error("updateReserves - Error al actualizar las reservas:", error);
    }
}


async function updateExchangeRate() {
    try {
        if (!simpleDexContract) {
            simpleDexContract = new ethers.Contract(simpleDexContractAddress, simpleDexContractABI, provider);
        }

        // Leemos las reservas individualmente ya que son variables públicas
        const reserveA = await simpleDexContract.reserveA();
        const reserveB = await simpleDexContract.reserveB();

        const reserves = [reserveA, reserveB];
        const exchangeRateAtoB = (parseFloat(reserves[1]) / parseFloat(reserves[0])).toFixed(6);
        const exchangeRateBtoA = (parseFloat(reserves[0]) / parseFloat(reserves[1])).toFixed(6);
        document.getElementById("exchangeRateAtoB").innerText = `1 Token A = ${exchangeRateAtoB} Token B`;
        document.getElementById("exchangeRateBtoA").innerText = `1 Token B = ${exchangeRateBtoA} Token A`;

        console.log("updateExchangeRate - Tasas de intercambio actualizadas:", exchangeRateAtoB, exchangeRateBtoA);
    } catch (error) {
        console.error("updateExchangeRate - Error al actualizar las tasas de intercambio:", error);
    }
}


window.copyToClipboard = function(elementId) {
    const element = document.getElementById(elementId);
    navigator.clipboard.writeText(element.textContent).then(() => {
        const tooltip = element.nextElementSibling;
        if (tooltip) {
            tooltip.textContent = '¡Copiado!';
            tooltip.classList.remove('hidden');
            setTimeout(() => {
                tooltip.textContent = 'Copiar';
                tooltip.classList.add('hidden');
            }, 1500);
        }
    });
}


// Estoy buscando el "btnConnect" y le estoy diciendo que cuando se haga click, se ejecute la función "connectWallet"
document.getElementById("btnConnect").addEventListener("click", connectWallet);
// Estoy buscando el "btnDisconnect" y le estoy diciendo que cuando se haga click, se ejecute la función "disconnectWallet"
document.getElementById("btnDisconnect").addEventListener("click", disconnectWallet);