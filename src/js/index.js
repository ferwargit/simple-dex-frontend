import { ethers } from "https://cdnjs.cloudflare.com/ajax/libs/ethers/6.7.0/ethers.min.js";
import { CONFIG } from './config.js';

let provider, signer, address, simpleDexContract;

// Variable global para almacenar los detalles de la última transacción de liquidez
let lastLiquidityAddTransactionDetails = null;
// Variable global para almacenar los detalles de la última transacción de retiro de liquidez
let lastLiquidityRemovalTransactionDetails = null;

// Variable global para almacenar los detalles de la última transacción de intercambio de Token A por Token B
let lastSwapAforBTransactionDetails = null;
// Variable global para almacenar los detalles de la última transacción de intercambio de Token B por Token A
let lastSwapBforATransactionDetails = null;

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
        // document.getElementById("status").textContent = `Conectado a la cuenta ${address}`;

        // Actualizar estado de conexión
        document.getElementById("status").textContent = "Conectado";
        // Mostrar detalles de la cuenta
        document.getElementById("connectedAccount").textContent = address;
        // Mostrar sección de detalles de cuenta
        document.getElementById("accountDetails").style.display = "block";

        // Obtener y mostrar la red
        try {
            const network = await provider.getNetwork();
            const chainId = Number(network.chainId);

            const networkMap = {
                1: "Ethereum Mainnet",
                3: "Ropsten",
                4: "Rinkeby",
                42: "Kovan",
                56: "Binance Smart Chain",
                97: "Binance Smart Chain Testnet",
                137: "Polygon Mainnet",
                80001: "Mumbai",
                42161: "Arbitrum One",
                421611: "Arbitrum Goerli",
                10: "Optimism",
                420: "Optimism Goerli",
                42170: "Avalanche",
                43113: "Avalanche Fuji",
                43114: "Avalanche Mainnet",
                11155111: "Sepolia",
                534351: "Scroll Sepolia",
                // Agrega más redes aquí...
            };

            const networkName = networkMap[chainId] || `Red ${chainId}`;

            console.log(`Red detectada: ${networkName} ID: ${chainId}`);

            document.getElementById("connectedNetwork").textContent = networkName;

            console.log("Red detectada:", networkName, "ID:", chainId);
        } catch (error) {
            console.error("Error al obtener la red:", error);
            document.getElementById("connectedNetwork").textContent = "Red No Detectada";
        }


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

    // Ocultar los detalles de la cuenta
    document.getElementById("accountDetails").style.display = "none";
    // Limpiar valores
    document.getElementById("connectedAccount").textContent = "-";
    document.getElementById("connectedNetwork").textContent = "-";

    // Actualizamos el estado
    document.getElementById("status").textContent = "Desconectado";

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

        document.getElementById("reserveA").innerText = `${ethers.formatUnits(reserveA, 18)}`;
        document.getElementById("reserveB").innerText = `${ethers.formatUnits(reserveB, 18)}`;

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
        // Verificar y reinicializar el contrato si es necesario
        if (!simpleDexContract) {
            simpleDexContract = new ethers.Contract(
                simpleDexContractAddress,
                simpleDexContractABI,
                provider
            );
        }

        // Obtener reservas de forma segura con Promise.all
        const [reserveA, reserveB] = await Promise.all([
            simpleDexContract.reserveA(),
            simpleDexContract.reserveB()
        ]);

        // Conversión segura a números, manejando casos de reservas cero
        const reserveANum = parseFloat(reserveA.toString());
        const reserveBNum = parseFloat(reserveB.toString());

        // Calcular tasas de intercambio con manejo de división por cero
        let exchangeRateAtoB = "0.000000";
        let exchangeRateBtoA = "0.000000";

        if (reserveANum > 0 && reserveBNum > 0) {
            exchangeRateAtoB = (reserveBNum / reserveANum).toFixed(6);
            exchangeRateBtoA = (reserveANum / reserveBNum).toFixed(6);
        }

        // Actualizar elementos de la interfaz
        const exchangeRateAtoBElement = document.getElementById("exchangeRateAtoB");
        const exchangeRateBtoAElement = document.getElementById("exchangeRateBtoA");

        if (exchangeRateAtoBElement && exchangeRateBtoAElement) {
            exchangeRateAtoBElement.innerText = `1 Token A = ${exchangeRateAtoB} Token B`;
            exchangeRateBtoAElement.innerText = `1 Token B = ${exchangeRateBtoA} Token A`;
        } else {
            console.warn("updateExchangeRate - Elementos de tasa de intercambio no encontrados");
        }

        // Logging detallado
        console.log("updateExchangeRate - Tasas de intercambio actualizadas:", {
            reserveA: reserveANum,
            reserveB: reserveBNum,
            exchangeRateAtoB,
            exchangeRateBtoA
        });

    } catch (error) {
        // Manejo de errores detallado
        console.error("updateExchangeRate - Error al actualizar las tasas de intercambio:", {
            message: error.message,
            name: error.name,
            stack: error.stack
        });

        // Opcional: Mostrar mensaje de error en la interfaz
        const exchangeRateAtoBElement = document.getElementById("exchangeRateAtoB");
        const exchangeRateBtoAElement = document.getElementById("exchangeRateBtoA");

        if (exchangeRateAtoBElement && exchangeRateBtoAElement) {
            exchangeRateAtoBElement.innerText = "Error al obtener tasa";
            exchangeRateBtoAElement.innerText = "Error al obtener tasa";
        }
    }
}


window.copyToClipboard = function (elementId) {
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


async function getTokenPrice() {
    try {
        // Verificamos que el contrato SimpleDex esté inicializado
        if (!simpleDexContract) {
            console.error("El contrato SimpleDex no está inicializado");
            return;
        }

        // Obtenemos la dirección del token desde el input
        const tokenAddressInput = document.getElementById("tokenAddress");
        const tokenAddress = tokenAddressInput.value.trim();

        // Validamos que se haya ingresado una dirección
        if (!tokenAddress) {
            console.error("Por favor ingrese una dirección de token");
            return;
        }

        // Llamamos a la función getPrice del contrato
        const price = await simpleDexContract.getPrice(tokenAddress);

        // Formateamos el precio (asumiendo 18 decimales)
        const formattedPrice = ethers.formatUnits(price, 18);

        // Mostramos el precio en la interfaz (puedes agregar un elemento para esto)
        console.log(`Precio del token: ${formattedPrice}`);

        // Mostrar el precio en la interfaz
        document.getElementById("tokenPrice").textContent = `Precio: ${formattedPrice}`;

    } catch (error) {
        console.error("Error al obtener el precio del token:", error);

        // Manejo de errores específicos
        if (error.code === "INVALID_ARGUMENT") {
            console.error("Dirección de token inválida");
        }
    }
}


function clearTokenPrice() {
    // Limpiar input de dirección
    const tokenAddressInput = document.getElementById("tokenAddress");
    if (tokenAddressInput) {
        tokenAddressInput.value = "";
    }

    // Restablecer precio del token
    const tokenPriceElement = document.getElementById("tokenPrice");
    if (tokenPriceElement) {
        tokenPriceElement.textContent = "-";
    }

    console.log("Precio del token y dirección limpiados");
}


async function swapTokenAforB() {
    try {
        // Verificamos que el contrato SimpleDex esté inicializado
        if (!simpleDexContract) {
            console.error("El contrato SimpleDex no está inicializado");
            return;
        }

        // Obtener la cantidad de Token A a intercambiar
        const amountAInput = document.getElementById("amountAIn");
        const amountAIn = amountAInput.value.trim();

        // Validaciones
        if (!amountAIn || isNaN(amountAIn) || Number(amountAIn) <= 0) {
            console.error("Cantidad de Token A inválida");
            return;
        }

        // Convertir a unidades del contrato (asumiendo 18 decimales)
        const amountAInWei = ethers.parseUnits(amountAIn, 18);

        // Llamar a la función de intercambio del contrato
        const tx = await simpleDexContract.swapAforB(amountAInWei);

        // Esperar confirmación de la transacción
        const receipt = await tx.wait();

        // Mostrar detalles de la transacción de intercambio
        showSwapAforBTransactionDetails(receipt, amountAIn);

        console.log("Intercambio de Token A a Token B exitoso:", receipt);

        // Limpiar input
        amountAInput.value = "";

        // Actualizar balances y tasas de intercambio 
        await Promise.all([
            updateExchangeRate(),
            updateTokenBalances(),
            updateReserves()
        ]);

    } catch (error) {
        console.error("Error en el intercambio de Token A por Token B:", error);

        // Manejo de errores específicos
        if (error.code === "ACTION_REJECTED") {
            console.log("Transacción cancelada por el usuario");
        }
    }
}


async function swapTokenBforA() {
    try {
        // Verificamos que el contrato SimpleDex esté inicializado
        if (!simpleDexContract) {
            console.error("El contrato SimpleDex no está inicializado");
            return;
        }

        // Obtener la cantidad de Token B a intercambiar
        const amountBInput = document.getElementById("amountBIn");
        const amountBIn = amountBInput.value.trim();

        // Validaciones
        if (!amountBIn || isNaN(amountBIn) || Number(amountBIn) <= 0) {
            console.error("Cantidad de Token B inválida");
            return;
        }

        // Convertir a unidades del contrato (asumiendo 18 decimales)
        const amountBInWei = ethers.parseUnits(amountBIn, 18);

        // Llamar a la función de intercambio del contrato
        const tx = await simpleDexContract.swapBforA(amountBInWei);

        // Esperar confirmación de la transacción
        const receipt = await tx.wait();

        // Mostrar detalles de la transacción de intercambio
        showSwapBforATransactionDetails(receipt, amountBIn);

        console.log("Intercambio de Token B a Token A exitoso:", receipt);

        // Limpiar input
        amountBInput.value = "";

        // Actualizar balances y tasas de intercambio 
        await Promise.all([
            updateExchangeRate(),
            updateTokenBalances(),
            updateReserves()
        ]);

    } catch (error) {
        console.error("Error en el intercambio de Token B por Token A:", error);

        // Manejo de errores específicos
        if (error.code === "ACTION_REJECTED") {
            console.log("Transacción cancelada por el usuario");
        }
    }
}


// Función para ocultar animaciones cuando se conecta la wallet
function toggleAnimations() {
    const animationsContainer = document.getElementById('animationsContainer');
    const walletConnected = document.getElementById('walletStatusSection').classList.contains('wallet-connected');

    if (animationsContainer && walletConnected) {
        animationsContainer.style.display = 'none';
    } else if (animationsContainer) {
        animationsContainer.style.display = 'block';
    }
}


// Función para agregar liquidez al DEX
async function addLiquidity() {
    try {
        // Validar que la wallet esté conectada
        if (!signer) {
            console.error("Por favor, conecta tu wallet primero");
            return;
        }

        // Obtener valores de los inputs
        const amountA = document.getElementById('amountA').value;
        const amountB = document.getElementById('amountB').value;

        // Validar que los montos no estén vacíos
        if (!amountA || !amountB) {
            console.error("Por favor, ingresa cantidades válidas para ambos tokens");
            return;
        }

        // Convertir montos a formato wei (asumiendo 18 decimales)
        const amountAWei = ethers.parseUnits(amountA, 18);
        const amountBWei = ethers.parseUnits(amountB, 18);

        // Crear contrato con signer
        const simpleDexContract = new ethers.Contract(
            simpleDexContractAddress,
            simpleDexContractABI,
            signer
        );

        // Llamar a la función addLiquidity del contrato
        const tx = await simpleDexContract.addLiquidity(amountAWei, amountBWei);

        // Esperar la confirmación de la transacción
        const receipt = await tx.wait();

        // Actualizar reservas después de agregar liquidez
        await updateReserves();

        // Actualizar tasa de intercambio
        await updateExchangeRate();

        // Actualizar balances de los tokens
        await updateTokenBalances();

        // Mostrar detalles de la transacción
        showLiquidityAddTransactionDetails(receipt, amountA, amountB);

        // Registrar mensaje de éxito
        console.log("Liquidez agregada exitosamente");

        // Limpiar los campos de entrada
        document.getElementById('amountA').value = '';
        document.getElementById('amountB').value = '';

        // Registrar detalles de la transacción
        console.log("Liquidez agregada. Hash de transacción:", receipt.hash);

    } catch (error) {
        // Manejar errores
        console.error("Error al agregar liquidez:", error);
    }
}


// Función para retirar liquidez del DEX
async function removeLiquidity() {
    try {
        // Validar que la wallet esté conectada
        if (!signer) {
            console.error("Por favor, conecta tu wallet primero");
            return;
        }

        // Obtener valores de los inputs
        const removeAmountA = document.getElementById('removeAmountA').value;
        const removeAmountB = document.getElementById('removeAmountB').value;

        // Validar que los montos no estén vacíos
        if (!removeAmountA || !removeAmountB) {
            console.error("Por favor, ingresa cantidades válidas para ambos tokens");
            return;
        }

        // Convertir montos a formato wei (asumiendo 18 decimales)
        const removeAmountAWei = ethers.parseUnits(removeAmountA, 18);
        const removeAmountBWei = ethers.parseUnits(removeAmountB, 18);

        // Crear contrato con signer
        const simpleDexContract = new ethers.Contract(
            simpleDexContractAddress,
            simpleDexContractABI,
            signer
        );

        // Llamar a la función removeLiquidity del contrato
        const tx = await simpleDexContract.removeLiquidity(removeAmountAWei, removeAmountBWei);

        // Esperar la confirmación de la transacción
        const receipt = await tx.wait();

        // Actualizar reservas después de retirar liquidez
        await updateReserves();

        // Actualizar tasa de intercambio
        await updateExchangeRate();

        // Actualizar balances de tokens
        await updateTokenBalances();

        // Mostrar detalles de la transacción de retiro
        showLiquidityRemovalTransactionDetails(receipt, removeAmountA, removeAmountB);

        // Registrar mensaje de éxito
        console.log("Liquidez retirada exitosamente");

        // Limpiar los campos de entrada
        document.getElementById('removeAmountA').value = '';
        document.getElementById('removeAmountB').value = '';

        // Registrar detalles de la transacción
        console.log("Liquidez retirada. Hash de transacción:", receipt.hash);

    } catch (error) {
        // Manejar errores
        console.error("Error al retirar liquidez:", error);
    }
}


// Función para mostrar detalles de la transacción de liquidez
function showLiquidityAddTransactionDetails(receipt, amountA, amountB) {
    // Almacenar los detalles de la transacción
    lastLiquidityAddTransactionDetails = { receipt, amountA, amountB };
    
    // Crear un modal o una sección de detalles de transacción
    const transactionDetailsContainer = document.createElement('div');
    transactionDetailsContainer.id = 'liquidityTransactionDetailsModal';
    transactionDetailsContainer.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
    
    transactionDetailsContainer.innerHTML = `
        <div class="bg-gray-800 p-6 rounded-lg shadow-md border border-white max-w-md w-full">
            <h2 class="text-2xl font-semibold text-white-800 mb-4">Detalles de Transacción</h2>
            
            <div class="mb-4">
                <p class="text-white-700">Hash de Transacción:</p>
                <p class="break-words text-blue-400">${receipt.hash}</p>
            </div>
            
            <div class="mb-4">
                <p class="text-white-700">Cantidad de Token A agregada:</p>
                <p class="text-green-500">${amountA} Tokens</p>
            </div>
            
            <div class="mb-4">
                <p class="text-white-700">Cantidad de Token B agregada:</p>
                <p class="text-green-500">${amountB} Tokens</p>
            </div>
            
            <div class="mb-4">
                <p class="text-white-700">Bloque:</p>
                <p class="text-white-500">${receipt.blockNumber}</p>
            </div>
            
            <button id="closeTransactionDetails" class="bg-blue-500 text-white px-6 py-2 rounded-md hover:bg-blue-600 transition mt-4">
                Cerrar
            </button>
        </div>
    `;
    
    // Eliminar cualquier modal existente
    const existingModal = document.getElementById('liquidityTransactionDetailsModal');
    if (existingModal) {
        document.body.removeChild(existingModal);
    }
    
    // Agregar al cuerpo del documento
    document.body.appendChild(transactionDetailsContainer);
    
    // Agregar evento para cerrar el modal
    document.getElementById('closeTransactionDetails').addEventListener('click', () => {
        document.body.removeChild(transactionDetailsContainer);
    });
}


// Función para abrir los detalles de la última transacción
function openLastAddLiquidityTransactionDetails() {
    if (lastLiquidityAddTransactionDetails) {
        const { receipt, amountA, amountB } = lastLiquidityAddTransactionDetails;
        showLiquidityAddTransactionDetails(receipt, amountA, amountB);
    } else {
        console.error("No hay detalles de transacción reciente");
    }
}


// Función para mostrar detalles de la transacción de retiro de liquidez
function showLiquidityRemovalTransactionDetails(receipt, removeAmountA, removeAmountB) {
    // Almacenar los detalles de la transacción
    lastLiquidityRemovalTransactionDetails = { receipt, removeAmountA, removeAmountB };
    
    // Crear un modal o una sección de detalles de transacción
    const transactionDetailsContainer = document.createElement('div');
    transactionDetailsContainer.id = 'liquidityRemovalTransactionDetailsModal';
    transactionDetailsContainer.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
    
    transactionDetailsContainer.innerHTML = `
        <div class="bg-gray-800 p-6 rounded-lg shadow-md border border-white max-w-md w-full">
            <h2 class="text-2xl font-semibold text-white-800 mb-4">Detalles de Retiro de Liquidez</h2>
            
            <div class="mb-4">
                <p class="text-white-700">Hash de Transacción:</p>
                <p class="break-words text-blue-400">${receipt.hash}</p>
            </div>
            
            <div class="mb-4">
                <p class="text-white-700">Cantidad de Token A retirada:</p>
                <p class="text-green-500">${removeAmountA} Tokens</p>
            </div>
            
            <div class="mb-4">
                <p class="text-white-700">Cantidad de Token B retirada:</p>
                <p class="text-green-500">${removeAmountB} Tokens</p>
            </div>
            
            <div class="mb-4">
                <p class="text-white-700">Bloque:</p>
                <p class="text-white-500">${receipt.blockNumber}</p>
            </div>
            
            <button id="closeRemovalTransactionDetails" class="bg-blue-500 text-white px-6 py-2 rounded-md hover:bg-blue-600 transition mt-4">
                Cerrar
            </button>
        </div>
    `;
    
    // Eliminar cualquier modal existente
    const existingModal = document.getElementById('liquidityRemovalTransactionDetailsModal');
    if (existingModal) {
        document.body.removeChild(existingModal);
    }
    
    // Agregar al cuerpo del documento
    document.body.appendChild(transactionDetailsContainer);
    
    // Agregar evento para cerrar el modal
    document.getElementById('closeRemovalTransactionDetails').addEventListener('click', () => {
        document.body.removeChild(transactionDetailsContainer);
    });
}


// Función para abrir los detalles de la última transacción de retiro de liquidez
function openLastLiquidityRemovalTransactionDetails() {
    if (lastLiquidityRemovalTransactionDetails) {
        const { receipt, removeAmountA, removeAmountB } = lastLiquidityRemovalTransactionDetails;
        showLiquidityRemovalTransactionDetails(receipt, removeAmountA, removeAmountB);
    } else {
        console.error("No hay detalles de transacción de retiro de liquidez reciente");
    }
}


// Función para mostrar detalles de la transacción de intercambio de Token A por Token B
function showSwapAforBTransactionDetails(receipt, amountAIn) {
    // Almacenar los detalles de la transacción
    lastSwapAforBTransactionDetails = { receipt, amountAIn };
    
    // Crear un modal o una sección de detalles de transacción
    const transactionDetailsContainer = document.createElement('div');
    transactionDetailsContainer.id = 'swapAforBTransactionDetailsModal';
    transactionDetailsContainer.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
    
    transactionDetailsContainer.innerHTML = `
        <div class="bg-gray-800 p-6 rounded-lg shadow-md border border-white max-w-md w-full">
            <h2 class="text-2xl font-semibold text-white-800 mb-4">Detalles de Intercambio TK-A por TK-B</h2>
            
            <div class="mb-4">
                <p class="text-white-700">Hash de Transacción:</p>
                <p class="break-words text-blue-400">${receipt.hash}</p>
            </div>
            
            <div class="mb-4">
                <p class="text-white-700">Cantidad de Token A intercambiada:</p>
                <p class="text-green-500">${amountAIn} Tokens</p>
            </div>
            
            <div class="mb-4">
                <p class="text-white-700">Bloque:</p>
                <p class="text-white-500">${receipt.blockNumber}</p>
            </div>
            
            <button id="closeSwapAforBTransactionDetails" class="bg-blue-500 text-white px-6 py-2 rounded-md hover:bg-blue-600 transition mt-4">
                Cerrar
            </button>
        </div>
    `;
    
    // Eliminar cualquier modal existente
    const existingModal = document.getElementById('swapAforBTransactionDetailsModal');
    if (existingModal) {
        document.body.removeChild(existingModal);
    }
    
    // Agregar al cuerpo del documento
    document.body.appendChild(transactionDetailsContainer);
    
    // Agregar evento para cerrar el modal
    document.getElementById('closeSwapAforBTransactionDetails').addEventListener('click', () => {
        document.body.removeChild(transactionDetailsContainer);
    });
}


// Función para abrir los detalles de la última transacción de intercambio de Token A por Token B
function openLastSwapAforBTransactionDetails() {
    if (lastSwapAforBTransactionDetails) {
        const { receipt, amountAIn } = lastSwapAforBTransactionDetails;
        showSwapAforBTransactionDetails(receipt, amountAIn);
    } else {
        console.error("No hay detalles de transacción de intercambio de Token A por Token B reciente");
    }
}


// Función para mostrar detalles de la transacción de intercambio de Token B por Token A
function showSwapBforATransactionDetails(receipt, amountBIn) {
    // Almacenar los detalles de la transacción
    lastSwapBforATransactionDetails = { receipt, amountBIn };
    
    // Crear un modal o una sección de detalles de transacción
    const transactionDetailsContainer = document.createElement('div');
    transactionDetailsContainer.id = 'swapBforATransactionDetailsModal';
    transactionDetailsContainer.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
    
    transactionDetailsContainer.innerHTML = `
        <div class="bg-gray-800 p-6 rounded-lg shadow-md border border-white max-w-md w-full">
            <h2 class="text-2xl font-semibold text-white-800 mb-4">Detalles de Intercambio TK-B por TK-A</h2>
            
            <div class="mb-4">
                <p class="text-white-700">Hash de Transacción:</p>
                <p class="break-words text-blue-400">${receipt.hash}</p>
            </div>
            
            <div class="mb-4">
                <p class="text-white-700">Cantidad de Token B intercambiada:</p>
                <p class="text-green-500">${amountBIn} Tokens</p>
            </div>
            
            <div class="mb-4">
                <p class="text-white-700">Bloque:</p>
                <p class="text-white-500">${receipt.blockNumber}</p>
            </div>
            
            <button id="closeSwapBforATransactionDetails" class="bg-blue-500 text-white px-6 py-2 rounded-md hover:bg-blue-600 transition mt-4">
                Cerrar
            </button>
        </div>
    `;
    
    // Eliminar cualquier modal existente
    const existingModal = document.getElementById('swapBforATransactionDetailsModal');
    if (existingModal) {
        document.body.removeChild(existingModal);
    }
    
    // Agregar al cuerpo del documento
    document.body.appendChild(transactionDetailsContainer);
    
    // Agregar evento para cerrar el modal
    document.getElementById('closeSwapBforATransactionDetails').addEventListener('click', () => {
        document.body.removeChild(transactionDetailsContainer);
    });
}


// Función para abrir los detalles de la última transacción de intercambio de Token B por Token A
function openLastSwapBforATransactionDetails() {
    if (lastSwapBforATransactionDetails) {
        const { receipt, amountBIn } = lastSwapBforATransactionDetails;
        showSwapBforATransactionDetails(receipt, amountBIn);
    } else {
        console.error("No hay detalles de transacción de intercambio de Token B por Token A reciente");
    }
}

// Estoy buscando el "btnConnect" y le estoy diciendo que cuando se haga click, se ejecute la función "connectWallet"
document.getElementById("btnConnect").addEventListener("click", connectWallet);
// Agregamos el event listener para el botón de obtener precio
document.getElementById("btnGetPrice").addEventListener("click", getTokenPrice);
// Estoy buscando el "btnDisconnect" y le estoy diciendo que cuando se haga click, se ejecute la función "disconnectWallet"
document.getElementById("btnDisconnect").addEventListener("click", disconnectWallet);
// Estoy buscando el "btnClearPrice" y le estoy diciendo que cuando se haga click, se ejecute la función "clearTokenPrice"
document.getElementById("btnClearPrice").addEventListener("click", clearTokenPrice);
// Agregamos el event listener para los botones de intercambio
document.getElementById("btnSwapAforB").addEventListener("click", swapTokenAforB);
document.getElementById("btnSwapBforA").addEventListener("click", swapTokenBforA);


// Agregar event listener al botón de agregar liquidez
document.getElementById("btnAddLiquidity").addEventListener("click", addLiquidity);
// Agregar event listener al botón de mostrar última transacción de agregar liquidez
document.getElementById('btnShowLastAddLiquidityTransaction').addEventListener('click', openLastAddLiquidityTransactionDetails);

// Agregar event listener al botón de retirar liquidez
document.getElementById("btnRemoveLiquidity").addEventListener("click", removeLiquidity);
// Agregar event listener al botón de mostrar última transacción de retiro de liquidez
document.getElementById('btnShowLastLiquidityTransaction').addEventListener('click', openLastLiquidityRemovalTransactionDetails);

// Agregar event listener al botón de mostrar última transacción de intercambio de Token A por Token B
document.getElementById('btnShowLastSwapAforBTransaction').addEventListener('click', openLastSwapAforBTransactionDetails);
// Agregar event listener al botón de mostrar última transacción de intercambio de Token B por Token A
document.getElementById('btnShowLastSwapBforATransaction').addEventListener('click', openLastSwapBforATransactionDetails);

// Llama a toggleAnimations cuando cambie el estado de la wallet
document.getElementById('btnConnect').addEventListener('click', () => {
    // Añade una clase para indicar que la wallet está conectada
    document.getElementById('walletStatusSection').classList.add('wallet-connected');
    toggleAnimations();
});
// Elimina la clase cuando se desconecta
document.getElementById('btnDisconnect').addEventListener('click', () => {
    document.getElementById('walletStatusSection').classList.remove('wallet-connected');
    toggleAnimations();
});

// Llamar inicialmente para establecer el estado correcto
toggleAnimations();